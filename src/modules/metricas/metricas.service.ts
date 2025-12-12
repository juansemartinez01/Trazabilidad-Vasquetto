import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  LoteProductoFinal,
  LotePfEstado,
} from '../lotes/entities/lote-producto-final.entity';
import { LoteMP } from '../lotes/entities/lote-mp.entity';
import { OrdenConsumo } from '../orden-produccion/entities/orden-consumo.entity';
import { EntregaItem } from '../entregas/entities/entrega-item.entity';
import {
  StockMovimiento,
  TipoMovimiento,
} from '../stock-movimiento/entities/stock-movimiento.entity';
import { MateriaPrima } from '../materia-prima/entities/materia-prima.entity';
import { DashboardMetricsDto } from './dto/dashboard-metrics.dto';

@Injectable()
export class MetricasService {
  constructor(
    @InjectRepository(LoteProductoFinal)
    private lotePFRepo: Repository<LoteProductoFinal>,
    @InjectRepository(LoteMP)
    private loteMPRepo: Repository<LoteMP>,
    @InjectRepository(OrdenConsumo)
    private consumoRepo: Repository<OrdenConsumo>,
    @InjectRepository(EntregaItem)
    private entregaItemRepo: Repository<EntregaItem>,
    @InjectRepository(StockMovimiento)
    private movRepo: Repository<StockMovimiento>,
    @InjectRepository(MateriaPrima)
    private mpRepo: Repository<MateriaPrima>,
  ) {}

  private parseRange(dto: DashboardMetricsDto) {
    const desde = dto.desde
      ? new Date(dto.desde + 'T00:00:00.000Z')
      : undefined;
    const hasta = dto.hasta
      ? new Date(dto.hasta + 'T23:59:59.999Z')
      : undefined;
    return { desde, hasta };
  }

  async dashboard(tenantId: string, dto: DashboardMetricsDto) {
    const { desde, hasta } = this.parseRange(dto);

    const [
      produccion,
      produccionPorEstado,
      consumoMP,
      entregasPorCliente,
      merma,
      alertas,
    ] = await Promise.all([
      this.produccionTotal(tenantId, desde, hasta),
      this.produccionPorEstado(tenantId, desde, hasta),
      this.consumoMP(tenantId, desde, hasta),
      this.entregasPorCliente(tenantId, desde, hasta),
      this.mermasMPyPF(tenantId, desde, hasta),
      this.alertasGlobales(tenantId),
    ]);

    return {
      rango: {
        desde: dto.desde ?? null,
        hasta: dto.hasta ?? null,
      },

      produccion: {
        totalKg: Number(produccion?.totalKg ?? 0),
        porEstado: produccionPorEstado.map((x) => ({
          estado: x.estado,
          totalKg: Number(x.totalKg ?? 0),
        })),
      },

      consumoMateriasPrimas: consumoMP.map((x) => ({
        materiaPrima: x.materiaPrima,
        totalKg: Number(x.totalKg ?? 0),
      })),

      entregas: {
        porCliente: entregasPorCliente.map((x) => ({
          cliente: x.cliente,
          totalKg: Number(x.totalKg ?? 0),
        })),
      },

      mermas: {
        mermaMPKg: Number(merma?.mermaMPKg ?? 0),
        mermaPFKg: Number(merma?.mermaPFKg ?? 0),
        mermaTotalKg: Number(merma?.mermaTotalKg ?? 0),
      },

      alertas,
    };
  }

  /** ============================
   * PRODUCCIÓN TOTAL (PF)
   ============================ */
  async produccionTotal(tenantId: string, desde?: Date, hasta?: Date) {
    const qb = this.lotePFRepo
      .createQueryBuilder('pf')
      .select('SUM(pf.cantidadInicialKg)', 'totalKg')
      .where('pf.tenantId = :tenantId', { tenantId });

    if (desde) qb.andWhere('pf.fechaProduccion >= :desde', { desde });
    if (hasta) qb.andWhere('pf.fechaProduccion <= :hasta', { hasta });

    return qb.getRawOne();
  }

  /** ============================
   * PRODUCCIÓN POR ESTADO (PF)
   ============================ */
  async produccionPorEstado(tenantId: string, desde?: Date, hasta?: Date) {
    const qb = this.lotePFRepo
      .createQueryBuilder('pf')
      .select('pf.estado', 'estado')
      .addSelect('SUM(pf.cantidadInicialKg)', 'totalKg')
      .where('pf.tenantId = :tenantId', { tenantId })
      .groupBy('pf.estado')
      .orderBy('SUM(pf.cantidadInicialKg)', 'DESC');

    if (desde) qb.andWhere('pf.fechaProduccion >= :desde', { desde });
    if (hasta) qb.andWhere('pf.fechaProduccion <= :hasta', { hasta });

    return qb.getRawMany();
  }

  /** ============================
   * CONSUMO MP POR PERÍODO
   ============================ */
  async consumoMP(tenantId: string, desde?: Date, hasta?: Date) {
    const qb = this.consumoRepo
      .createQueryBuilder('c')
      .leftJoin('c.ingrediente', 'i')
      .leftJoin('i.materiaPrima', 'mp')
      .select('mp.nombre', 'materiaPrima')
      .addSelect('SUM(c.cantidadKg)', 'totalKg')
      .where('c.tenantId = :tenantId', { tenantId })
      .groupBy('mp.nombre')
      .orderBy('SUM(c.cantidadKg)', 'DESC');

    if (desde) qb.andWhere('c.createdAt >= :desde', { desde });
    if (hasta) qb.andWhere('c.createdAt <= :hasta', { hasta });

    return qb.getRawMany();
  }

  /** ============================
   * ENTREGAS POR CLIENTE (KG)
   ============================ */
  async entregasPorCliente(tenantId: string, desde?: Date, hasta?: Date) {
    const qb = this.entregaItemRepo
      .createQueryBuilder('item')
      .leftJoin('item.entrega', 'e')
      .leftJoin('e.cliente', 'c')
      .select('c.razonSocial', 'cliente')
      .addSelect('SUM(item.cantidadKg)', 'totalKg')
      .where('item.tenantId = :tenantId', { tenantId })
      .groupBy('c.razonSocial')
      .orderBy('SUM(item.cantidadKg)', 'DESC');

    if (desde) qb.andWhere('e.fecha >= :desde', { desde });
    if (hasta) qb.andWhere('e.fecha <= :hasta', { hasta });

    return qb.getRawMany();
  }

  /** ============================
   * MERMAS MP/PF POR PERÍODO
   * (normaliza a positivo)
   ============================ */
  async mermasMPyPF(tenantId: string, desde?: Date, hasta?: Date) {
    const qb = this.movRepo
      .createQueryBuilder('m')
      .select(
        `
        SUM(CASE WHEN m.tipo = :mermaMP THEN ABS(m.cantidadKg) ELSE 0 END)
      `,
        'mermaMPKg',
      )
      .addSelect(
        `
        SUM(CASE WHEN m.tipo = :mermaPF THEN ABS(m.cantidadKg) ELSE 0 END)
      `,
        'mermaPFKg',
      )
      .addSelect(
        `
        SUM(CASE WHEN m.tipo IN (:...tipos) THEN ABS(m.cantidadKg) ELSE 0 END)
      `,
        'mermaTotalKg',
      )
      .where('m.tenantId = :tenantId', { tenantId })
      .setParameters({
        mermaMP: TipoMovimiento.MERMA_MP,
        mermaPF: TipoMovimiento.MERMA_PF,
        tipos: [TipoMovimiento.MERMA_MP, TipoMovimiento.MERMA_PF],
      });

    if (desde) qb.andWhere('m.createdAt >= :desde', { desde });
    if (hasta) qb.andWhere('m.createdAt <= :hasta', { hasta });

    return qb.getRawOne();
  }

  /** ============================
   * ALERTAS (corregidas)
   ============================ */
  async alertasGlobales(tenantId: string) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const limite = new Date();
    limite.setDate(hoy.getDate() + 30);
    limite.setHours(23, 59, 59, 999);

    // MP próximas a vencer
    const mpProximas = await this.loteMPRepo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere('l.fechaVencimiento BETWEEN :hoy AND :limite', { hoy, limite })
      .orderBy('l.fechaVencimiento', 'ASC')
      .getMany();

    // PF próximas a vencer (✅ usando fechaVencimiento)
    const pfProximas = await this.lotePFRepo
      .createQueryBuilder('pf')
      .where('pf.tenantId = :tenantId', { tenantId })
      .andWhere('pf.fechaVencimiento IS NOT NULL')
      .andWhere('pf.fechaVencimiento BETWEEN :hoy AND :limite', { hoy, limite })
      .orderBy('pf.fechaVencimiento', 'ASC')
      .getMany();

    // Stock mínimo (si tu entidad MateriaPrima tiene esos campos)
    const stockBajo = await this.mpRepo
      .createQueryBuilder('mp')
      .where('mp.tenantId = :tenantId', { tenantId })
      .andWhere('mp.stockActualKg < mp.stockMinKg')
      .getMany();

    return {
      mpProximasAVencer: mpProximas,
      pfProximasAVencer: pfProximas,
      stockBajo,
    };
  }
}
