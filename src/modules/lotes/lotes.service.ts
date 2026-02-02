import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoteMP } from './entities/lote-mp.entity';
import { LotePfEstado, LoteProductoFinal } from './entities/lote-producto-final.entity';
import { CambiarEstadoLotePfDto } from './dto/cambiar-estado-lote-pf.dto';
import { QueryLotesPfDto } from './dto/query-lotes-pf.dto';


function parseBool(v?: string): boolean | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().toLowerCase();
  if (['true', '1', 'yes', 'si'].includes(s)) return true;
  if (['false', '0', 'no'].includes(s)) return false;
  return null;
}


@Injectable()
export class LotesService {
  constructor(
    @InjectRepository(LoteMP)
    private loteMpRepo: Repository<LoteMP>,

    @InjectRepository(LoteProductoFinal)
    private lotePfRepo: Repository<LoteProductoFinal>,
  ) {}

  /** LOTES DE MATERIA PRIMA */
  listarLotesMP(tenantId: string) {
    return this.loteMpRepo.find({
      where: { tenantId },
      relations: ['materiaPrima', 'deposito'],
      order: { fechaVencimiento: 'ASC' },
    });
  }

  /** LOTES DE PRODUCTO FINAL */
  /** ✅ LISTAR PF con filtros + paginado + orden + búsqueda */
  async listarLotesPF(tenantId: string, q: QueryLotesPfDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 30;
    const skip = (page - 1) * limit;

    const qb = this.lotePfRepo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId })
      .leftJoin('l.deposito', 'dep')
      .leftJoin('l.productoFinal', 'pf');

    // ✅ usar PROPERTY PATHS (no nombres de columna DB)
    qb.select([
      'l.id',
      'l.codigoLote',
      'l.cantidadInicialKg',
      'l.cantidadActualKg',
      'l.fechaProduccion',
      'l.fechaVencimiento',
      'l.estado',
      'l.motivoEstado',
      'l.fechaEstado',
      'l.createdAt',
      'dep.id',
      'dep.nombre',
      'pf.id',
      'pf.nombre',
      'pf.codigo',
    ]);

    // 🔎 búsqueda libre
    if (q.q?.trim()) {
      const term = `%${q.q.trim()}%`;
      qb.andWhere(
        `(l.codigoLote ILIKE :term OR pf.nombre ILIKE :term OR pf.codigo ILIKE :term)`,
        { term },
      );
    }

    // filtros directos
    if (q.estado) qb.andWhere('l.estado = :estado', { estado: q.estado });
    if (q.depositoId)
      qb.andWhere('dep.id = :depositoId', { depositoId: q.depositoId });
    if (q.productoFinalId)
      qb.andWhere('pf.id = :productoFinalId', {
        productoFinalId: q.productoFinalId,
      });

    // rangos de producción
    if (q.produccionDesde)
      qb.andWhere('l.fechaProduccion >= :pd', { pd: q.produccionDesde });
    if (q.produccionHasta)
      qb.andWhere('l.fechaProduccion <= :ph', { ph: q.produccionHasta });

    // rangos de vencimiento
    if (q.vencimientoDesde)
      qb.andWhere('l.fechaVencimiento >= :vd', { vd: q.vencimientoDesde });
    if (q.vencimientoHasta)
      qb.andWhere('l.fechaVencimiento <= :vh', { vh: q.vencimientoHasta });

    // stock
    const conStock = q.conStock === 'true';
    const sinStock = q.sinStock === 'true';

    if (conStock && !sinStock) qb.andWhere('l.cantidadActualKg > 0');
    if (sinStock && !conStock) qb.andWhere('l.cantidadActualKg <= 0');

    // ✅ whitelist de orden con PROPERTY PATHS
    const sortMap: Record<string, string> = {
      fechaProduccion: 'l.fechaProduccion',
      fechaVencimiento: 'l.fechaVencimiento',
      codigoLote: 'l.codigoLote',
      estado: 'l.estado',
      cantidadActualKg: 'l.cantidadActualKg',
      createdAt: 'l.createdAt',
    };

    const sortCol =
      sortMap[q.sort ?? 'fechaProduccion'] ?? sortMap.fechaProduccion;
    const dir = (q.dir ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    qb.orderBy(sortCol, dir as 'ASC' | 'DESC')
      .addOrderBy('l.id', 'DESC')
      .skip(skip)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      items,
    };
  }

  async cambiarEstadoPF(
    tenantId: string,
    loteId: string,
    dto: CambiarEstadoLotePfDto,
  ) {
    const lote = await this.lotePfRepo.findOne({
      where: { id: loteId, tenantId },
    });
    if (!lote) throw new NotFoundException('Lote PF no encontrado');

    // Reglas simples para evitar incoherencias
    if (lote.estado === LotePfEstado.ENTREGADO) {
      throw new BadRequestException(
        'El lote ya está ENTREGADO y no puede cambiar de estado',
      );
    }
    if (
      lote.estado === LotePfEstado.DESCARTADO &&
      dto.estado !== LotePfEstado.DESCARTADO
    ) {
      throw new BadRequestException(
        'Un lote DESCARTADO no puede volver a otro estado',
      );
    }

    lote.estado = dto.estado;
    lote.motivoEstado = dto.motivoEstado ?? null;
    lote.fechaEstado = new Date();

    return this.lotePfRepo.save(lote);
  }
}
