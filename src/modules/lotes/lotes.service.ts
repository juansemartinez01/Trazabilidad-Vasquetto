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
      .where('l.tenant_id = :tenantId', { tenantId })
      // joins controlados (solo lo necesario)
      .leftJoin('l.deposito', 'dep')
      .leftJoin('l.productoFinal', 'pf');

    // ✅ select “proyección” (evita traer todo el objeto PF/Deposito si no hace falta)
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
        `(l.codigo_lote ILIKE :term OR pf.nombre ILIKE :term OR pf.codigo ILIKE :term)`,
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

    // rangos por producción
    if (q.produccionDesde)
      qb.andWhere('l.fecha_produccion >= :pd', { pd: q.produccionDesde });
    if (q.produccionHasta)
      qb.andWhere('l.fecha_produccion <= :ph', { ph: q.produccionHasta });

    // rangos por vencimiento (incluye nulls? acá NO; si querés incluir nulls lo hacemos opcional)
    if (q.vencimientoDesde)
      qb.andWhere('l.fecha_vencimiento >= :vd', { vd: q.vencimientoDesde });
    if (q.vencimientoHasta)
      qb.andWhere('l.fecha_vencimiento <= :vh', { vh: q.vencimientoHasta });

    // stock
    const conStock = parseBool(q.conStock);
    const sinStock = parseBool(q.sinStock);

    if (conStock === true && sinStock === true) {
      // no filtra (contradicción útil: trae todo)
    } else if (conStock === true) {
      qb.andWhere('l.cantidad_actual_kg > 0');
    } else if (sinStock === true) {
      qb.andWhere('l.cantidad_actual_kg <= 0');
    }

    // ordenar seguro (whitelist)
    const sortMap: Record<string, string> = {
      fechaProduccion: 'l.fecha_produccion',
      fechaVencimiento: 'l.fecha_vencimiento',
      codigoLote: 'l.codigo_lote',
      estado: 'l.estado',
      cantidadActualKg: 'l.cantidad_actual_kg',
      createdAt: 'l.created_at',
    };

    const sortCol =
      sortMap[q.sort ?? 'fechaProduccion'] ?? sortMap.fechaProduccion;
    const dir = (q.dir ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    qb.orderBy(sortCol, dir as 'ASC' | 'DESC')
      // desempate estable
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
