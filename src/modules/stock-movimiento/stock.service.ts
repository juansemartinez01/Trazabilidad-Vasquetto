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
    if (!lote) throw new NotFoundException('Lote no encontrado');

    lote.cantidadActualKg += Number(cantidadAjuste);
    await this.loteRepo.save(lote);

    await this.movRepo.save(
      this.movRepo.create({
        tenantId,
        tipo: TipoMovimiento.AJUSTE,
        loteMP: lote,
        deposito: lote.deposito,
        cantidadKg: cantidadAjuste,
        referenciaId: motivo,
      }),
    );

    return lote;
  }

  /** ======================
   *  SELECCIÓN FEFO
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

    const seleccionados: Array<{ lote: LoteMP; cantidad: number }> = [];
    let restante = cantidadNecesaria;

    for (const lote of lotes) {
      if (lote.cantidadActualKg <= 0) continue;

      const usar = Math.min(restante, Number(lote.cantidadActualKg));

      seleccionados.push({
        lote,
        cantidad: usar,
      });

      restante -= usar;

      if (restante <= 0) break;
    }

    if (restante > 0) {
      throw new BadRequestException('Stock insuficiente aplicando FEFO');
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
}
