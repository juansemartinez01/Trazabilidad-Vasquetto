import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Recepcion } from './entities/recepcion.entity';
import { LoteMP } from '../lotes/entities/lote-mp.entity';
import { MateriaPrima } from '../materia-prima/entities/materia-prima.entity';
import { Deposito } from '../deposito/entities/deposito.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { QueryRecepcionesDto } from './dto/query-recepciones.dto';

@Injectable()
export class RecepcionesService {
  constructor(
    @InjectRepository(Recepcion) private recepcionRepo: Repository<Recepcion>,
    @InjectRepository(LoteMP) private loteRepo: Repository<LoteMP>,
    @InjectRepository(MateriaPrima) private mpRepo: Repository<MateriaPrima>,
    @InjectRepository(Deposito) private depRepo: Repository<Deposito>,
    private auditoria: AuditoriaService,
  ) {}

  async crear(tenantId: string, usuarioId: string, dto: any) {
    const recepcion = this.recepcionRepo.create({
      tenantId,
      numeroRemito: dto.numeroRemito,
      fechaRemito: dto.fechaRemito,
      transportista: dto.transportista,
      proveedor: { id: dto.proveedorId },
      documentos: dto.documentos,
    });

    await this.recepcionRepo.save(recepcion);

    // Crear lotes
    for (const item of dto.lotes) {
      const mp = await this.mpRepo.findOne({
        where: { id: item.materiaPrimaId, tenantId },
      });
      if (!mp) throw new NotFoundException('Materia prima no encontrada');

      const dep = await this.depRepo.findOne({
        where: { id: item.depositoId, tenantId },
      });
      if (!dep) throw new NotFoundException('Depósito no encontrado');

      // calcular fecha vencimiento
      const fechaElab = new Date(item.fechaElaboracion);
      const meses = item.mesesVencimiento ?? 24;
      const fechaVto = new Date(fechaElab);
      fechaVto.setMonth(fechaVto.getMonth() + meses);

      const lote = this.loteRepo.create({
        tenantId,
        recepcion,
        materiaPrima: mp,
        deposito: dep,
        codigoLote: item.codigoLote,
        fechaElaboracion: item.fechaElaboracion,
        fechaAnalisis: item.fechaAnalisis,
        fechaVencimiento: fechaVto,
        cantidadInicialKg: item.cantidadKg,
        cantidadActualKg: item.cantidadKg,
        analisis: item.analisis,
        documentos: item.documentos,
      });

      await this.loteRepo.save(lote);
    }

    // Auditoría
    await this.auditoria.registrar(tenantId, usuarioId, 'RECEPCION_CREADA', {
      remito: recepcion.numeroRemito,
    });

    return this.recepcionRepo.findOne({
      where: { id: recepcion.id },
      relations: ['lotes', 'lotes.materiaPrima', 'lotes.deposito'],
    });
  }

  findAll(tenantId: string) {
    return this.recepcionRepo.find({
      where: { tenantId },
      relations: ['proveedor', 'lotes'],
    });
  }

  private applyFilters(
    qb: SelectQueryBuilder<Recepcion>,
    tenantId: string,
    q: QueryRecepcionesDto,
  ) {
    qb.andWhere('r.tenant_id = :tenantId', { tenantId });

    // joins (solo cuando hacen falta)
    qb.leftJoin('r.proveedor', 'p');

    const needsLotesJoin =
      !!q.codigoLote ||
      !!q.materiaPrimaId ||
      !!q.depositoId ||
      !!q.fechaElaboracionDesde ||
      !!q.fechaElaboracionHasta ||
      !!q.fechaVencimientoDesde ||
      !!q.fechaVencimientoHasta ||
      !!q.search;

    if (needsLotesJoin) {
      qb.leftJoin(
        LoteMP,
        'l',
        'l.recepcion_id = r.id AND l.tenant_id = :tenantId',
        { tenantId },
      );
      qb.leftJoin('l.materiaPrima', 'mp');
      qb.leftJoin('l.deposito', 'd');
    }

    // Filtros Recepcion
    if (q.id) qb.andWhere('r.id = :id', { id: q.id });

    if (q.numeroRemito) {
      qb.andWhere('r.numero_remito ILIKE :nr', { nr: `%${q.numeroRemito}%` });
    }

    if (q.fechaRemitoDesde) {
      qb.andWhere('r.fecha_remito >= :frd', { frd: q.fechaRemitoDesde });
    }
    if (q.fechaRemitoHasta) {
      qb.andWhere('r.fecha_remito <= :frh', { frh: q.fechaRemitoHasta });
    }

    if (q.transportista) {
      qb.andWhere('r.transportista ILIKE :t', { t: `%${q.transportista}%` });
    }

    if (q.proveedorId) {
      qb.andWhere('p.id = :pid', { pid: q.proveedorId });
    }

    if (q.proveedorNombre) {
      qb.andWhere('p.nombre ILIKE :pn', { pn: `%${q.proveedorNombre}%` });
    }

    // Filtros por Lote / MP / Depósito
    if (q.codigoLote) {
      qb.andWhere('l.codigo_lote ILIKE :cl', { cl: `%${q.codigoLote}%` });
    }

    if (q.materiaPrimaId) {
      qb.andWhere('mp.id = :mpid', { mpid: q.materiaPrimaId });
    }

    if (q.depositoId) {
      qb.andWhere('d.id = :did', { did: q.depositoId });
    }

    if (q.fechaElaboracionDesde) {
      qb.andWhere('l.fecha_elaboracion >= :fed', {
        fed: q.fechaElaboracionDesde,
      });
    }
    if (q.fechaElaboracionHasta) {
      qb.andWhere('l.fecha_elaboracion <= :feh', {
        feh: q.fechaElaboracionHasta,
      });
    }

    if (q.fechaVencimientoDesde) {
      qb.andWhere('l.fecha_vencimiento >= :fvd', {
        fvd: q.fechaVencimientoDesde,
      });
    }
    if (q.fechaVencimientoHasta) {
      qb.andWhere('l.fecha_vencimiento <= :fvh', {
        fvh: q.fechaVencimientoHasta,
      });
    }

    // Search multi-campo (cuando hay joins)
    if (q.search) {
      const s = `%${q.search}%`;
      qb.andWhere(
        `(
          r.numero_remito ILIKE :s
          OR r.transportista ILIKE :s
          OR p.nombre ILIKE :s
          OR l.codigo_lote ILIKE :s
          OR mp.nombre ILIKE :s
          OR d.nombre ILIKE :s
        )`,
        { s },
      );
    }

    return qb;
  }

  private applyOrder(
    qb: SelectQueryBuilder<Recepcion>,
    q: QueryRecepcionesDto,
    opts?: { distinctOnId?: boolean },
  ) {
    const map: Record<string, string> = {
      fechaRemito: 'r.fecha_remito',
      numeroRemito: 'r.numero_remito',
      createdAt: 'r.created_at',
      proveedorNombre: 'p.nombre',
      transportista: 'r.transportista',
    };

    const campo = map[q.ordenCampo ?? 'fechaRemito'] ?? map.fechaRemito;
    const dir = (q.ordenDireccion ?? 'DESC') as 'ASC' | 'DESC';

    // Si vamos a usar DISTINCT ON (r.id), Postgres necesita que el ORDER BY
    // arranque por la/s columna/s del DISTINCT ON.
    if (opts?.distinctOnId) {
      qb.orderBy('r.id', 'ASC'); // requerido para DISTINCT ON (r.id)
      qb.addOrderBy(campo, dir);
      qb.addOrderBy('r.id', 'DESC'); // desempate estable
      return qb;
    }

    qb.orderBy(campo, dir).addOrderBy('r.id', 'DESC');
    return qb;
  }

  async obtenerTodasConFiltros(tenantId: string, q: QueryRecepcionesDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    const offset = (page - 1) * limit;

    // 1) IDs paginados
    const idsQb = this.recepcionRepo.createQueryBuilder('r');
    this.applyFilters(idsQb, tenantId, q);

    idsQb.select('r.id', 'id');
    idsQb.distinctOn(['r.id']);

    this.applyOrder(idsQb, q, { distinctOnId: true });
    idsQb.offset(offset).limit(limit);

    // 2) Total distinct
    const countQb = this.recepcionRepo.createQueryBuilder('r');
    this.applyFilters(countQb, tenantId, q);
    const total = await countQb
      .select('COUNT(DISTINCT r.id)', 'total')
      .getRawOne<{ total: string }>();

    const idsRaw = await idsQb.getRawMany<{ id: string }>();
    const ids = idsRaw.map((x) => x.id);

    if (ids.length === 0) {
      return { data: [], total: Number(total?.total ?? 0), page, limit };
    }

    // 3) Fetch final (con relaciones)
    const fetchQb = this.recepcionRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.proveedor', 'p') // aunque sea eager, acá queda explícito
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.id IN (:...ids)', { ids });

    // ✅ Traer info completa de MP ingresada => VIENE POR LOS LOTES
    // Si querés que SIEMPRE venga, sacá el if y dejalo fijo.
    if (q.includeLotes) {
      fetchQb
        .leftJoinAndSelect('r.lotes', 'l')
        .leftJoinAndSelect('l.materiaPrima', 'mp')
        .leftJoinAndSelect('l.deposito', 'd');
      // si LoteMP tiene más relaciones útiles, se agregan acá:
      // .leftJoinAndSelect('l.presentacion', 'pres')
      // .leftJoinAndSelect('l.movimientos', 'mov')  (si existiera)
    }

    // orden estable
    this.applyOrder(fetchQb, q);
    fetchQb.addOrderBy('r.id', 'ASC');

    const data = await fetchQb.getMany();

    return {
      data,
      total: Number(total?.total ?? 0),
      page,
      limit,
    };
  }
}
