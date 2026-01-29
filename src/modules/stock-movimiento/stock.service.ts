import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LoteMP } from './../lotes/entities/lote-mp.entity';
import { In, Repository } from 'typeorm';
import {
  StockMovimiento,
  TipoMovimiento,
} from './entities/stock-movimiento.entity';
import { Deposito } from './../deposito/entities/deposito.entity';
import { LotePfEstado, LoteProductoFinal } from '../lotes/entities/lote-producto-final.entity';
import { ProductoFinal } from '../producto-final/entities/producto-final.entity';
import { MateriaPrima } from '../materia-prima/entities/materia-prima.entity';
import { StockMinimoPF } from '../configuracion/entities/stock-minimo-pf.entity';
import { StockMinimoMP } from '../configuracion/entities/stock-minimo-mp.entity';
import { QueryResumenPfDto } from './dto/query-resumen-pf.dto';



function parseEstados(raw?: string): LotePfEstado[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .filter((x) => Object.values(LotePfEstado).includes(x as LotePfEstado))
    .map((x) => x as LotePfEstado);
}


@Injectable()
export class StockService {
  constructor(
    @InjectRepository(LoteMP) private loteRepo: Repository<LoteMP>,
    @InjectRepository(StockMovimiento)
    private movRepo: Repository<StockMovimiento>,
    @InjectRepository(Deposito) private depRepo: Repository<Deposito>,
    @InjectRepository(LoteProductoFinal)
    private lotePFRepo: Repository<LoteProductoFinal>,

    // ✅ NUEVO
    @InjectRepository(StockMinimoMP)
    private minMpRepo: Repository<StockMinimoMP>,
    @InjectRepository(StockMinimoPF)
    private minPfRepo: Repository<StockMinimoPF>,
    @InjectRepository(MateriaPrima) private mpRepo: Repository<MateriaPrima>,
    @InjectRepository(ProductoFinal) private pfRepo: Repository<ProductoFinal>,
  ) {}

  /** ======================
   *  INGRESO DE STOCK
   ======================= */

  async ingresoLoteMP(
    tenantId: string,
    loteId: string,
    cantidad: number,
    referenciaId: string,
  ) {
    const lote = await this.loteRepo.findOne({
      where: { id: loteId, tenantId },
    });
    if (!lote) throw new NotFoundException('Lote no encontrado');

    lote.cantidadActualKg += Number(cantidad);
    await this.loteRepo.save(lote);

    await this.movRepo.save(
      this.movRepo.create({
        tenantId,
        tipo: TipoMovimiento.RECEPCION,
        loteMP: lote,
        deposito: lote.deposito,
        cantidadKg: cantidad,
        referenciaId,
      }),
    );

    return lote;
  }

  /** ======================
   *  EGRESO DE STOCK (CONSUMO)
   ======================= */

  async consumirLote(
    tenantId: string,
    loteId: string,
    cantidad: number,
    tipo: TipoMovimiento,
    referenciaId: string,
  ) {
    const lote = await this.loteRepo.findOne({
      where: { id: loteId, tenantId },
    });
    if (!lote) throw new NotFoundException('Lote no encontrado');

    if (lote.cantidadActualKg < cantidad) {
      throw new BadRequestException(
        `Stock insuficiente en lote ${lote.codigoLote}`,
      );
    }

    lote.cantidadActualKg -= Number(cantidad);
    await this.loteRepo.save(lote);

    await this.movRepo.save(
      this.movRepo.create({
        tenantId,
        tipo,
        loteMP: lote,
        deposito: lote.deposito,
        cantidadKg: -cantidad,
        referenciaId,
      }),
    );

    return lote;
  }

  /** ======================
   *  AJUSTE DE STOCK
   ======================= */

  async ajustarStock(
    tenantId: string,
    loteId: string,
    cantidadAjuste: number,
    motivo: string,
  ) {
    const lote = await this.loteRepo.findOne({
      where: { id: loteId, tenantId },
    });

    if (!lote) {
      throw new NotFoundException('Lote no encontrado');
    }

    // Siempre castear a número porque viene como string desde la DB (decimal)
    const actual = Number(lote.cantidadActualKg ?? 0);
    const ajuste = Number(cantidadAjuste);

    if (Number.isNaN(ajuste)) {
      throw new BadRequestException('cantidadAjuste debe ser numérico');
    }

    const nuevoValor = actual + ajuste;

    // Opcional, por si no querés que quede negativo
    if (nuevoValor < 0) {
      throw new BadRequestException(
        `El ajuste dejaría el lote con stock negativo (actual: ${actual}, ajuste: ${ajuste})`,
      );
    }

    lote.cantidadActualKg = nuevoValor;
    await this.loteRepo.save(lote);

    await this.movRepo.save(
      this.movRepo.create({
        tenantId,
        tipo: TipoMovimiento.AJUSTE,
        loteMP: lote,
        deposito: lote.deposito,
        cantidadKg: ajuste,
        referenciaId: motivo,
      }),
    );

    return lote;
  }

  /** ======================
   *  SELECCIÓN FEFO
   ======================= */

  /** ======================
 *  SELECCIÓN FEFO (ESTRICTO: NO CONSUMIR VENCIDOS)
 ======================= */
  async obtenerLotesFEFO(
    tenantId: string,
    materiaPrimaId: string,
    cantidadNecesaria: number,
  ) {
    const lotes = await this.loteRepo.find({
      where: {
        tenantId,
        materiaPrima: { id: materiaPrimaId },
      },
      order: { fechaVencimiento: 'ASC' },
    });

    // Normalizamos "hoy" sin hora para comparar solo fechas
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const seleccionados: Array<{ lote: LoteMP; cantidad: number }> = [];
    let restante = Number(cantidadNecesaria);

    // ✅ FEFO estricto: ignorar vencidos
    for (const lote of lotes) {
      const stock = Number(lote.cantidadActualKg ?? 0);
      if (stock <= 0) continue;

      const vto = new Date(lote.fechaVencimiento);
      vto.setHours(0, 0, 0, 0);

      // 🔒 SI ESTÁ VENCIDO -> IGNORAR
      if (vto < hoy) continue;

      const usar = Math.min(restante, stock);

      seleccionados.push({
        lote,
        cantidad: usar,
      });

      restante -= usar;

      if (restante <= 0) break;
    }

    if (restante > 0) {
      // 🔥 Error claro: no alcanza sin vencidos
      throw new BadRequestException(
        `Stock insuficiente sin usar lotes vencidos (faltan ${restante} kg)`,
      );
    }

    return seleccionados;
  }

  /** ======================
   *  ALERTAS
   ======================= */

  async alertasStock(tenantId: string) {
    const hoy = new Date();
    const proximos30 = new Date();
    proximos30.setDate(hoy.getDate() + 30);

    const vencidos = await this.loteRepo.find({
      where: { tenantId },
    });

    return {
      vencidos: vencidos.filter((l) => new Date(l.fechaVencimiento) < hoy),
      proximosAVencer: vencidos.filter(
        (l) =>
          new Date(l.fechaVencimiento) >= hoy &&
          new Date(l.fechaVencimiento) <= proximos30,
      ),
    };
  }

  /** =====================================
   *    INGRESO DE LOTE PF
   ===================================== */
  async ingresoLotePF(
    tenantId: string,
    lotePFId: string,
    cantidad: number,
    referenciaId: string,
  ) {
    const lote = await this.lotePFRepo.findOne({
      where: { id: lotePFId, tenantId },
    });

    if (!lote) throw new NotFoundException('Lote PF no encontrado');

    // ✅ NO tocar acumulado del lote acá (ya se setea al crearlo)
    // lote.cantidadActualKg += Number(cantidad);
    // await this.lotePFRepo.save(lote);

    await this.movRepo.save(
      this.movRepo.create({
        tenantId,
        tipo: TipoMovimiento.PRODUCCION_INGRESO,
        lotePF: lote,
        deposito: lote.deposito,
        cantidadKg: Number(cantidad), // por las dudas normalizamos
        referenciaId,
      }),
    );

    return lote;
  }

  /** =====================================
   *    EGRESO DE LOTE PF (NUEVO)
   ===================================== */
  async consumirLotePF(
    tenantId: string,
    lotePFId: string,
    cantidad: number,
    tipo: TipoMovimiento,
    referenciaId: string,
  ) {
    const lote = await this.lotePFRepo.findOne({
      where: { id: lotePFId, tenantId },
    });

    if (!lote) throw new NotFoundException('Lote PF no encontrado');

    if (lote.cantidadActualKg < cantidad) {
      throw new BadRequestException(
        `Stock insuficiente en lote PF ${lote.codigoLote}`,
      );
    }

    lote.cantidadActualKg -= Number(cantidad);
    await this.lotePFRepo.save(lote);

    await this.movRepo.save(
      this.movRepo.create({
        tenantId,
        tipo,
        lotePF: lote,
        deposito: lote.deposito,
        cantidadKg: -cantidad,
        referenciaId,
      }),
    );

    return lote;
  }

  // StockService

  async registrarMermaMP(
    tenantId: string,
    loteId: string,
    dto: {
      cantidadKg: number;
      motivo: string;
      responsableId?: string;
      evidencia?: any;
    },
  ) {
    // merma = ajuste negativo
    const ajuste = -Math.abs(Number(dto.cantidadKg));
    if (Number.isNaN(ajuste))
      throw new BadRequestException('cantidadKg debe ser numérico');

    const lote = await this.loteRepo.findOne({
      where: { id: loteId, tenantId },
    });
    if (!lote) throw new NotFoundException('Lote no encontrado');

    const actual = Number(lote.cantidadActualKg ?? 0);
    const nuevoValor = actual + ajuste;

    if (nuevoValor < 0) {
      throw new BadRequestException(
        `La merma dejaría el lote con stock negativo (actual: ${actual}, merma: ${Math.abs(ajuste)})`,
      );
    }

    lote.cantidadActualKg = nuevoValor;
    await this.loteRepo.save(lote);

    await this.movRepo.save(
      this.movRepo.create({
        tenantId,
        tipo: TipoMovimiento.MERMA_MP,
        loteMP: lote,
        deposito: lote.deposito,
        cantidadKg: ajuste, // negativo ✅
        referenciaId: 'MERMA_MP', // si querés mantenerlo
        motivo: dto.motivo,
        responsableId: dto.responsableId,
        evidencia: dto.evidencia,
      }),
    );

    return lote;
  }

  async registrarMermaPF(
    tenantId: string,
    lotePFId: string,
    dto: {
      cantidadKg: number;
      motivo: string;
      responsableId?: string;
      evidencia?: any;
    },
  ) {
    const cantidad = Math.abs(Number(dto.cantidadKg));
    if (Number.isNaN(cantidad))
      throw new BadRequestException('cantidadKg debe ser numérico');

    const lote = await this.lotePFRepo.findOne({
      where: { id: lotePFId, tenantId },
    });
    if (!lote) throw new NotFoundException('Lote PF no encontrado');

    if (Number(lote.cantidadActualKg) < cantidad) {
      throw new BadRequestException(
        `Stock insuficiente en lote PF ${lote.codigoLote}`,
      );
    }

    lote.cantidadActualKg = Number(lote.cantidadActualKg) - cantidad;
    await this.lotePFRepo.save(lote);

    await this.movRepo.save(
      this.movRepo.create({
        tenantId,
        tipo: TipoMovimiento.MERMA_PF,
        lotePF: lote,
        deposito: lote.deposito,
        cantidadKg: -cantidad, // negativo ✅
        referenciaId: 'MERMA_PF',
        motivo: dto.motivo,
        responsableId: dto.responsableId,
        evidencia: dto.evidencia,
      }),
    );

    return lote;
  }

  // ======================================
  //   RESUMEN STOCK MATERIA PRIMA (MP)
  // ======================================
  async resumenStockMP(tenantId: string) {
    const lotes = await this.loteRepo.find({
      where: { tenantId },
      relations: ['materiaPrima', 'deposito'],
      order: { fechaVencimiento: 'ASC' },
    });

    const map = new Map<
      string,
      {
        materiaPrimaId: string;
        nombre: string;
        unidadMedida: string;
        stockTotalKg: number;
        lotes: Array<{
          loteId: string;
          codigoLote: string;
          depositoId: string;
          depositoNombre: string;
          fechaVencimiento: Date;
          cantidadActualKg: number;
        }>;
      }
    >();

    for (const lote of lotes) {
      const mp = lote.materiaPrima;
      if (!mp) continue;

      const key = mp.id;
      const cantidad = Number(lote.cantidadActualKg ?? 0);

      if (!map.has(key)) {
        map.set(key, {
          materiaPrimaId: mp.id,
          nombre: mp.nombre,
          unidadMedida: mp.unidadMedida,
          stockTotalKg: 0,
          lotes: [],
        });
      }

      const entry = map.get(key)!;
      entry.stockTotalKg += cantidad;

      entry.lotes.push({
        loteId: lote.id,
        codigoLote: lote.codigoLote,
        depositoId: lote.deposito?.id,
        depositoNombre: lote.deposito?.nombre,
        fechaVencimiento: lote.fechaVencimiento,
        cantidadActualKg: cantidad,
      });
    }

    // si querés, podés filtrar los que tienen 0 total
    return Array.from(map.values());
    // return Array.from(map.values()).filter((x) => x.stockTotalKg > 0);
  }

  // ======================================
  //   RESUMEN STOCK PRODUCTO FINAL (PF)
  // ======================================
  async resumenStockPF(tenantId: string, q?: QueryResumenPfDto) {
    const estados = [
      ...(q?.estado ? [q.estado] : []),
      ...parseEstados(q?.estados),
    ];

    const where: any = { tenantId };
    if (estados.length) {
      // si mandan estado/estados, filtramos
      where.estado = In(estados);
    }

    const lotes = await this.lotePFRepo.find({
      where,
      relations: ['productoFinal', 'deposito'],
      order: { fechaProduccion: 'DESC' },
    });

    const map = new Map<
      string,
      {
        productoFinalId: string;
        codigo: string;
        nombre: string;
        stockTotalKg: number;
        lotes: Array<{
          loteId: string;
          codigoLote: string;
          depositoId: string;
          depositoNombre: string;
          fechaProduccion: Date;
          fechaVencimiento: Date | null;
          estado: string;
          cantidadActualKg: number;
        }>;
      }
    >();

    for (const lote of lotes) {
      const pf = lote.productoFinal;
      if (!pf) continue;

      const key = pf.id;
      const cantidad = Number(lote.cantidadActualKg ?? 0);

      if (!map.has(key)) {
        map.set(key, {
          productoFinalId: pf.id,
          codigo: pf.codigo,
          nombre: pf.nombre,
          stockTotalKg: 0,
          lotes: [],
        });
      }

      const entry = map.get(key)!;
      entry.stockTotalKg += cantidad;

      entry.lotes.push({
        loteId: lote.id,
        codigoLote: lote.codigoLote,
        depositoId: lote.deposito?.id,
        depositoNombre: lote.deposito?.nombre,
        fechaProduccion: lote.fechaProduccion,
        fechaVencimiento: lote.fechaVencimiento,
        estado: lote.estado,
        cantidadActualKg: cantidad,
      });
    }

    return Array.from(map.values());
  }

  async materiasPrimasBajoMinimo(tenantId: string) {
    // Stock total por MP (sumando lotes)
    const stockPorMp = await this.loteRepo
      .createQueryBuilder('l')
      .select('l.materia_prima_id', 'materiaPrimaId')
      .addSelect('COALESCE(SUM(l.cantidad_actual_kg), 0)', 'stockActualKg')
      .where('l.tenant_id = :tenantId', { tenantId })
      .groupBy('l.materia_prima_id')
      .getRawMany<{ materiaPrimaId: string; stockActualKg: string }>();

    const stockMap = new Map(
      stockPorMp.map((x) => [x.materiaPrimaId, Number(x.stockActualKg ?? 0)]),
    );

    // Mínimos configurados (solo para las MPs que tienen mínimo definido)
    const minimos = await this.minMpRepo.find({
      where: { tenantId },
      relations: ['materiaPrima'],
    });

    const result = minimos
      .map((m) => {
        const mp = m.materiaPrima;
        const stockActualKg = stockMap.get(mp.id) ?? 0;
        const stockMinKg = Number(m.stockMinKg ?? 0);
        const faltanteKg = Math.max(0, stockMinKg - stockActualKg);

        return {
          materiaPrimaId: mp.id,
          nombre: mp.nombre,
          unidadMedida: (mp as any).unidadMedida ?? null, // si existe en tu entity
          stockActualKg,
          stockMinKg,
          faltanteKg,
        };
      })
      .filter((x) => x.stockActualKg < x.stockMinKg)
      .sort((a, b) => b.faltanteKg - a.faltanteKg);

    return result;
  }

  async productosFinalesBajoMinimo(tenantId: string) {
    const stockPorPf = await this.lotePFRepo
      .createQueryBuilder('l')
      .select('l.producto_final_id', 'productoFinalId')
      .addSelect('COALESCE(SUM(l.cantidad_actual_kg), 0)', 'stockActualKg')
      .where('l.tenant_id = :tenantId', { tenantId })
      .groupBy('l.producto_final_id')
      .getRawMany<{ productoFinalId: string; stockActualKg: string }>();

    const stockMap = new Map(
      stockPorPf.map((x) => [x.productoFinalId, Number(x.stockActualKg ?? 0)]),
    );

    const minimos = await this.minPfRepo.find({
      where: { tenantId },
      relations: ['productoFinal'],
    });

    const result = minimos
      .map((m) => {
        const pf = m.productoFinal;
        const stockActualKg = stockMap.get(pf.id) ?? 0;
        const stockMinKg = Number(m.stockMinKg ?? 0);
        const faltanteKg = Math.max(0, stockMinKg - stockActualKg);

        return {
          productoFinalId: pf.id,
          codigo: pf.codigo,
          nombre: pf.nombre,
          stockActualKg,
          stockMinKg,
          faltanteKg,
        };
      })
      .filter((x) => x.stockActualKg < x.stockMinKg)
      .sort((a, b) => b.faltanteKg - a.faltanteKg);

    return result;
  }
}
