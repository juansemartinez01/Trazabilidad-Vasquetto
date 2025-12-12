import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LoteMP } from './../lotes/entities/lote-mp.entity';
import { Repository } from 'typeorm';
import {
  StockMovimiento,
  TipoMovimiento,
} from './entities/stock-movimiento.entity';
import { Deposito } from './../deposito/entities/deposito.entity';
import { LoteProductoFinal } from '../lotes/entities/lote-producto-final.entity';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(LoteMP) private loteRepo: Repository<LoteMP>,
    @InjectRepository(StockMovimiento)
    private movRepo: Repository<StockMovimiento>,
    @InjectRepository(Deposito) private depRepo: Repository<Deposito>,
    @InjectRepository(LoteProductoFinal)
    private lotePFRepo: Repository<LoteProductoFinal>,
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

    lote.cantidadActualKg += Number(cantidad);
    await this.lotePFRepo.save(lote);

    await this.movRepo.save(
      this.movRepo.create({
        tenantId,
        tipo: TipoMovimiento.PRODUCCION_INGRESO,
        lotePF: lote,
        deposito: lote.deposito,
        cantidadKg: cantidad,
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
}
