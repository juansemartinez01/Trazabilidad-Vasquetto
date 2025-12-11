import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Between, Repository } from 'typeorm';
import { LoteProductoFinal } from '../lotes/entities/lote-producto-final.entity';
import { LoteMP } from '../lotes/entities/lote-mp.entity';
import { OrdenConsumo } from '../orden-produccion/entities/orden-consumo.entity';
import { EntregaItem } from '../entregas/entities/entrega-item.entity';
import { StockMovimiento } from '../stock-movimiento/entities/stock-movimiento.entity';
import { MateriaPrima } from '../materia-prima/entities/materia-prima.entity';
import { DashboardMetricsDto } from './dto/dashboard-metrics.dto';

@Injectable()
export class MetricasService {
  constructor(
    @InjectRepository(LoteProductoFinal)
    private lotePFRepo: Repository<LoteProductoFinal>,
    @InjectRepository(LoteMP) private loteMPRepo: Repository<LoteMP>,
    @InjectRepository(OrdenConsumo)
    private consumoRepo: Repository<OrdenConsumo>,
    @InjectRepository(EntregaItem)
    private entregaItemRepo: Repository<EntregaItem>,
    @InjectRepository(StockMovimiento)
    private movRepo: Repository<StockMovimiento>,
    @InjectRepository(MateriaPrima) private mpRepo: Repository<MateriaPrima>,
  ) {}

  /** Helper para rango de fechas */
  private parseRange(dto: DashboardMetricsDto) {
    const desde = dto.desde ? new Date(dto.desde) : undefined;
    const hasta = dto.hasta ? new Date(dto.hasta) : undefined;
    return { desde, hasta };
  }

  /** MÉTRICAS PRINCIPALES */
  async dashboard(tenantId: string, dto: DashboardMetricsDto) {
    const { desde, hasta } = this.parseRange(dto);

    const [prod, mpProv, consumo, ventas, merma, alertas] = await Promise.all([
      this.toneladasProducidas(tenantId, desde, hasta),
      this.toneladasMPPorProveedor(tenantId, desde, hasta),
      this.consumoMP(tenantId, desde, hasta),
      this.ventasPorCliente(tenantId, desde, hasta),
      this.mermas(tenantId, desde, hasta),
      this.alertasGlobales(tenantId),
    ]);

    return {
      produccion: prod?.totalKg ?? 0,
      materiasPrimasPorProveedor: mpProv,
      consumoMateriasPrimas: consumo,
      ventasPorCliente: ventas,
      merma: merma?.mermaKg ?? 0,
      alertas,
    };
  }

  async toneladasProducidas(tenantId: string, desde?: Date, hasta?: Date) {
    const qb = this.lotePFRepo
      .createQueryBuilder('pf')
      .select('SUM(pf.cantidadInicialKg)', 'totalKg')
      .where('pf.tenantId = :tenantId', { tenantId });

    if (desde) qb.andWhere('pf.fechaProduccion >= :desde', { desde });
    if (hasta) qb.andWhere('pf.fechaProduccion <= :hasta', { hasta });

    return await qb.getRawOne();
  }

  async toneladasMPPorProveedor(tenantId: string, desde?: Date, hasta?: Date) {
    const qb = this.loteMPRepo
      .createQueryBuilder('mp')
      .leftJoin('mp.recepcion', 'r')
      .leftJoin('r.proveedor', 'p')
      .select('p.nombre', 'proveedor')
      .addSelect('SUM(mp.cantidadInicialKg)', 'totalKg')
      .where('mp.tenantId = :tenantId', { tenantId })
      .groupBy('p.nombre');

    if (desde) qb.andWhere('r.fechaRemito >= :desde', { desde });
    if (hasta) qb.andWhere('r.fechaRemito <= :hasta', { hasta });

    return await qb.getRawMany();
  }

  async consumoMP(tenantId: string, desde?: Date, hasta?: Date) {
    const qb = this.consumoRepo
      .createQueryBuilder('c')
      .leftJoin('c.ingrediente', 'i')
      .leftJoin('i.materiaPrima', 'mp')
      .select('mp.nombre', 'materiaPrima')
      .addSelect('SUM(c.cantidadKg)', 'totalKg')
      .where('c.tenantId = :tenantId', { tenantId })
      .groupBy('mp.nombre');

    if (desde) qb.andWhere('c.createdAt >= :desde', { desde });
    if (hasta) qb.andWhere('c.createdAt <= :hasta', { hasta });

    return await qb.getRawMany();
  }

  async ventasPorCliente(tenantId: string, desde?: Date, hasta?: Date) {
    const qb = this.entregaItemRepo
      .createQueryBuilder('item')
      .leftJoin('item.entrega', 'e')
      .leftJoin('e.cliente', 'c')
      .select('c.razonSocial', 'cliente')
      .addSelect('SUM(item.cantidadKg)', 'totalKg')
      .where('item.tenantId = :tenantId', { tenantId })
      .groupBy('c.razonSocial');

    if (desde) qb.andWhere('e.fecha >= :desde', { desde });
    if (hasta) qb.andWhere('e.fecha <= :hasta', { hasta });

    return await qb.getRawMany();
  }

  async mermas(tenantId: string, desde?: Date, hasta?: Date) {
    const qb = this.movRepo
      .createQueryBuilder('m')
      .select('SUM(m.cantidadKg)', 'mermaKg')
      .where('m.tenantId = :tenantId', { tenantId })
      .andWhere("m.tipo = 'MERMA'");

    if (desde) qb.andWhere('m.createdAt >= :desde', { desde });
    if (hasta) qb.andWhere('m.createdAt <= :hasta', { hasta });

    return await qb.getRawOne();
  }

  async alertasGlobales(tenantId: string) {
    const hoy = new Date();
    const limite = new Date();
    limite.setDate(hoy.getDate() + 30);

    // MP próximas a vencer
    const mpVencimiento = await this.loteMPRepo.find({
      where: {
        tenantId,
        fechaVencimiento: Between(hoy, limite),
      },
    });

    // Producto final próximo a vencer
    const pfVencimiento = await this.lotePFRepo.find({
      where: {
        tenantId,
        fechaProduccion: Between(hoy, limite),
      },
    });

    // Stock mínimo
    const stockBajo = await this.mpRepo
      .createQueryBuilder('mp')
      .where('mp.tenantId = :tenantId', { tenantId })
      .andWhere('mp.stockActualKg < mp.stockMinKg')
      .getMany();

    return {
      mpVencimiento,
      pfVencimiento,
      stockBajo,
    };
  }

  // las funciones anteriores van aquí...
}
