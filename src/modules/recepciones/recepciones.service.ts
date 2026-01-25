import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { Recepcion } from './entities/recepcion.entity';
import { LoteMP } from '../lotes/entities/lote-mp.entity';
import { MateriaPrima } from '../materia-prima/entities/materia-prima.entity';
import { Deposito } from '../deposito/entities/deposito.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { QueryRecepcionesDto } from './dto/query-recepciones.dto';
import { UpdateRecepcionDto } from './dto/update-recepcion.dto';
import { Proveedor } from '../proveedores/entities/proveedor.entity';
import { StockMovimiento, TipoMovimiento } from '../stock-movimiento/entities/stock-movimiento.entity';

@Injectable()
export class RecepcionesService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(Recepcion) private recepcionRepo: Repository<Recepcion>,
    @InjectRepository(LoteMP) private loteRepo: Repository<LoteMP>,
    @InjectRepository(MateriaPrima) private mpRepo: Repository<MateriaPrima>,
    @InjectRepository(Deposito) private depRepo: Repository<Deposito>,
    @InjectRepository(Proveedor) private provRepo: Repository<Proveedor>,
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

    /* =========================
   * 1) IDS PAGINADOS
   ========================= */
    const idsQb = this.recepcionRepo.createQueryBuilder('r');
    this.applyFilters(idsQb, tenantId, q);

    idsQb.select('r.id', 'id').distinctOn(['r.id']);

    this.applyOrder(idsQb, q, { distinctOnId: true });
    idsQb.offset(offset).limit(limit);

    /* =========================
   * 2) TOTAL DISTINCT
   ========================= */
    const countQb = this.recepcionRepo.createQueryBuilder('r');
    this.applyFilters(countQb, tenantId, q);

    const total = await countQb
      .select('COUNT(DISTINCT r.id)', 'total')
      .getRawOne<{ total: string }>();

    const idsRaw = await idsQb.getRawMany<{ id: string }>();
    const ids = idsRaw.map((x) => x.id);

    if (ids.length === 0) {
      return {
        data: [],
        total: Number(total?.total ?? 0),
        page,
        limit,
      };
    }

    /* =========================
   * 3) FETCH FINAL COMPLETO
   ========================= */
    const fetchQb = this.recepcionRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.proveedor', 'p')
      .leftJoinAndSelect('r.lotes', 'l') // ✅ LOTES
      .leftJoinAndSelect('l.materiaPrima', 'mp') // ✅ MP
      .leftJoinAndSelect('l.deposito', 'd') // ✅ DEPÓSITO
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.id IN (:...ids)', { ids });

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

  async editarCabecera(
    tenantId: string,
    usuarioId: string,
    recepcionId: string,
    dto: UpdateRecepcionDto,
  ) {
    // 1) Traer recepción del tenant
    const recepcion = await this.recepcionRepo.findOne({
      where: { id: recepcionId, tenantId },
      relations: ['proveedor'], // para auditar cambios con datos previos
    });
    if (!recepcion) throw new NotFoundException('Recepción no encontrada');

    // 2) Validar proveedor si viene
    if (dto.proveedorId) {
      const prov = await this.provRepo.findOne({
        where: { id: dto.proveedorId, tenantId },
      });
      if (!prov) throw new NotFoundException('Proveedor no encontrado');
      recepcion.proveedor = prov;
    }

    // 3) Aplicar cambios simples (solo si vienen)
    if (dto.numeroRemito !== undefined)
      recepcion.numeroRemito = dto.numeroRemito.trim();

    if (dto.fechaRemito !== undefined) {
      // date column: guardamos como Date (más limpio)
      const d = new Date(dto.fechaRemito);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('fechaRemito inválida');
      }
      recepcion.fechaRemito = d as any;
    }

    if (dto.transportista !== undefined) {
      recepcion.transportista = dto.transportista?.trim() || '0';
    }

    if (dto.documentos !== undefined) {
      recepcion.documentos = dto.documentos; // jsonb
    }

    // 4) Guardar
    await this.recepcionRepo.save(recepcion);

    // 5) Auditoría (ideal: guardar before/after)
    await this.auditoria.registrar(tenantId, usuarioId, 'RECEPCION_EDITADA', {
      recepcionId,
      numeroRemito: recepcion.numeroRemito,
    });

    // 6) Devolver con relaciones consistentes (sin romper frontend)
    return this.recepcionRepo.findOne({
      where: { id: recepcionId, tenantId },
      relations: ['proveedor', 'lotes', 'lotes.materiaPrima', 'lotes.deposito'],
    });
  }

  /**
   * Elimina una recepción "como si nunca existió":
   * - Solo si ningún lote fue consumido (actual == inicial)
   * - Borra movimientos de stock vinculados a la recepción (Tipo RECEPCION + referenciaId)
   * - Borra la recepción (CASCADE borra lotes)
   */
  async eliminar(tenantId: string, usuarioId: string, recepcionId: string) {
    return this.ds.transaction(async (trx) => {
      const recepcionRepo = trx.getRepository(Recepcion);
      const loteRepo = trx.getRepository(LoteMP);
      const movRepo = trx.getRepository(StockMovimiento);

      // =========================
      // 1) LOCK RECEPCION (SIN JOINS)
      // =========================
      const recepcion = await recepcionRepo
        .createQueryBuilder('r')
        .select([
          'r.id',
          'r.tenantId',
          'r.numeroRemito',
          'r.fechaRemito',
          'r.transportista',
          'r.documentos',
        ])
        .where('r.id = :id', { id: recepcionId })
        .andWhere('r.tenant_id = :tenantId', { tenantId })
        .setLock('pessimistic_write') // ✅ FOR UPDATE solo sobre recepciones
        .getOne();

      if (!recepcion) throw new NotFoundException('Recepción no encontrada');

      // (opcional) traer proveedor SIN LOCK y SIN PROBLEMAS
      const recepcionConProveedor = await recepcionRepo.findOne({
        where: { id: recepcionId, tenantId },
        relations: ['proveedor'],
      });

      // =========================
      // 2) TRAER + LOCK LOTES
      // =========================
      const lotes = await loteRepo
        .createQueryBuilder('l')
        .leftJoinAndSelect('l.materiaPrima', 'mp')
        .leftJoinAndSelect('l.deposito', 'd')
        .where('l.tenant_id = :tenantId', { tenantId })
        .andWhere('l.recepcion_id = :rid', { rid: recepcionId })
        .setLock('pessimistic_write') // ✅ lockea filas de lotes_mp
        .getMany();

      // =========================
      // 3) VALIDACIONES
      // =========================
      const EPS = 0.000001;
      for (const l of lotes) {
        const ini = Number(l.cantidadInicialKg ?? 0);
        const act = Number(l.cantidadActualKg ?? 0);
        if (Math.abs(act - ini) > EPS) {
          throw new BadRequestException(
            `No se puede eliminar: el lote ${l.codigoLote} ya fue consumido o modificado (inicial=${ini}, actual=${act}).`,
          );
        }
      }

      // extra: que no existan movimientos NO-RECEPCION en esos lotes
      const loteIds = lotes.map((l) => l.id);
      if (loteIds.length > 0) {
        const otrosMov = await movRepo
          .createQueryBuilder('m')
          .select(['m.id', 'm.tipo'])
          .where('m.tenant_id = :tenantId', { tenantId })
          .andWhere('m.loteMPId IN (:...loteIds)', { loteIds })
          .andWhere('m.tipo <> :t', { t: TipoMovimiento.RECEPCION })
          .limit(1)
          .getMany();

        if (otrosMov.length > 0) {
          throw new BadRequestException(
            `No se puede eliminar: existen movimientos posteriores sobre los lotes (ej: ${otrosMov[0].tipo}).`,
          );
        }
      }

      // =========================
      // 4) BORRAR MOVS RECEPCION
      // =========================
      await movRepo.delete({
        tenantId,
        tipo: TipoMovimiento.RECEPCION,
        referenciaId: recepcionId,
      });

      // =========================
      // 5) BORRAR RECEPCION (CASCADE LOTES)
      // =========================
      await recepcionRepo.delete({ id: recepcionId, tenantId });

      // =========================
      // 6) AUDITORIA
      // =========================
      await this.auditoria.registrar(
        tenantId,
        usuarioId,
        'RECEPCION_ELIMINADA',
        {
          recepcionId,
          numeroRemito: recepcion.numeroRemito,
          fechaRemito: recepcion.fechaRemito,
          proveedorId: recepcionConProveedor?.proveedor?.id ?? null,
          lotes: lotes.map((l) => ({
            loteId: l.id,
            codigoLote: l.codigoLote,
            materiaPrimaId: l.materiaPrima?.id ?? null,
            depositoId: l.deposito?.id ?? null,
            cantidadKg: Number(l.cantidadInicialKg ?? 0),
          })),
        },
      );

      return { ok: true, recepcionId, deletedLotes: lotes.length };
    });
  }
}
