import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';

import {
  Transferencia,
  TransferenciaEstado,
  TransferenciaTipo,
} from './entities/transferencia.entity';
import { TransferenciaItem } from './entities/transferencia-item.entity';
import { TransferenciaUnidad } from './entities/transferencia-unidad.entity';

import { Deposito } from '../deposito/entities/deposito.entity';
import { LoteMP } from '../lotes/entities/lote-mp.entity';
import {
  LotePfEstado,
  LoteProductoFinal,
} from '../lotes/entities/lote-producto-final.entity';
import {
  PresentacionProductoFinal,
  UnidadVenta,
} from '../producto-final/entities/presentacion-producto-final.entity';
import { PFUnidadEnvasada } from '../empaques/entities/pf-unidad-envasada.entity';
import { StockPresentacion } from '../empaques/entities/stock-presentacion.entity';

import { CreateTransferenciaDto } from './dto/create-transferencia.dto';

import {
  StockMovimiento,
  TipoMovimiento,
} from '../stock-movimiento/entities/stock-movimiento.entity';
import { QueryTransferenciasDto } from './dto/query-transferencias.dto';

function dec(n: any) {
  const v = Number(n);
  if (Number.isNaN(v)) return 0;
  return v;
}

function isPgUniqueViolation(e: any) {
  // Postgres unique_violation
  return e?.code === '23505';
}

@Injectable()
export class TransferenciasService {
  constructor(
    private ds: DataSource,

    @InjectRepository(Transferencia) private repo: Repository<Transferencia>,
    @InjectRepository(TransferenciaItem)
    private itemRepo: Repository<TransferenciaItem>,
    @InjectRepository(TransferenciaUnidad)
    private tuRepo: Repository<TransferenciaUnidad>,

    @InjectRepository(Deposito) private depRepo: Repository<Deposito>,
    @InjectRepository(LoteMP) private loteMpRepo: Repository<LoteMP>,
    @InjectRepository(LoteProductoFinal)
    private lotePfRepo: Repository<LoteProductoFinal>,
    @InjectRepository(PresentacionProductoFinal)
    private presRepo: Repository<PresentacionProductoFinal>,
    @InjectRepository(PFUnidadEnvasada)
    private unidadRepo: Repository<PFUnidadEnvasada>,
    @InjectRepository(StockPresentacion)
    private stockPresRepo: Repository<StockPresentacion>,

    @InjectRepository(StockMovimiento)
    private movRepo: Repository<StockMovimiento>,
  ) {}

  // =========================
  // Crear
  // =========================
  async crear(
    tenantId: string,
    usuarioId: string | null,
    dto: CreateTransferenciaDto,
  ) {
    if (dto.origenDepositoId === dto.destinoDepositoId) {
      throw new BadRequestException(
        'origenDepositoId y destinoDepositoId no pueden ser iguales',
      );
    }
    if (!dto.items?.length)
      throw new BadRequestException('La transferencia debe tener items');

    const origen = await this.depRepo.findOne({
      where: { id: dto.origenDepositoId, tenantId },
    });
    if (!origen) throw new NotFoundException('Depósito origen no encontrado');

    const destino = await this.depRepo.findOne({
      where: { id: dto.destinoDepositoId, tenantId },
    });
    if (!destino) throw new NotFoundException('Depósito destino no encontrado');

    // Validación por tipo + anti-combinaciones inválidas
    for (const it of dto.items) {
      if (dto.tipo === TransferenciaTipo.MP) {
        if (!it.loteMpId) throw new BadRequestException('MP requiere loteMpId');
        if (it.lotePfId || it.presentacionId)
          throw new BadRequestException(
            'Item MP no puede incluir lotePfId/presentacionId',
          );
        const kg = dec(it.cantidadKg);
        if (kg <= 0)
          throw new BadRequestException('MP requiere cantidadKg > 0');
      }

      if (dto.tipo === TransferenciaTipo.PF_GRANEL) {
        if (!it.lotePfId)
          throw new BadRequestException('PF_GRANEL requiere lotePfId');
        if (it.loteMpId || it.presentacionId)
          throw new BadRequestException(
            'Item PF_GRANEL no puede incluir loteMpId/presentacionId',
          );
        const kg = dec(it.cantidadKg);
        if (kg <= 0)
          throw new BadRequestException('PF_GRANEL requiere cantidadKg > 0');
      }

      if (dto.tipo === TransferenciaTipo.PF_ENVASADO) {
        if (!it.presentacionId)
          throw new BadRequestException('PF_ENVASADO requiere presentacionId');

        // ✅ ahora SOLO prohibimos MP / PF granel
        if (it.loteMpId || it.lotePfId)
          throw new BadRequestException(
            'Item PF_ENVASADO no puede incluir loteMpId/lotePfId',
          );

        const cant = Number(it.cantidadUnidades ?? 0);
        if (!Number.isFinite(cant) || cant <= 0) {
          throw new BadRequestException(
            'PF_ENVASADO requiere cantidadUnidades > 0',
          );
        }

        // ✅ opcional: si viene lotePfOrigenId, lo validamos como UUID ya lo hace class-validator
      }
    }

    const t = this.repo.create({
      tenantId,
      fecha: dto.fecha,
      origenDeposito: origen,
      destinoDeposito: destino,
      tipo: dto.tipo,
      estado: TransferenciaEstado.BORRADOR,
      observaciones: dto.observaciones ?? null,
      responsable: dto.responsableId
        ? ({ id: dto.responsableId } as any)
        : null,
      items: [],
      unidades: [],
    });

    const saved = await this.repo.save(t);

    // Batch save (más eficiente)
    const items = dto.items.map((it) =>
      this.itemRepo.create({
        tenantId,
        transferencia: saved,
        descripcion: it.descripcion ?? null,
        cantidadKg: it.cantidadKg ?? null,
        cantidadUnidades: it.cantidadUnidades ?? null,
        loteMp: it.loteMpId ? ({ id: it.loteMpId } as any) : null,
        lotePf: it.lotePfId ? ({ id: it.lotePfId } as any) : null,
        presentacion: it.presentacionId
          ? ({ id: it.presentacionId } as any)
          : null,
        lotePfOrigen: it.lotePfOrigenId
          ? ({ id: it.lotePfOrigenId } as any)
          : null,
      }),
    );

    await this.itemRepo.save(items);

    return this.obtener(tenantId, saved.id);
  }

  // =========================
  // Obtener / Listar
  // =========================
  obtener(tenantId: string, id: string) {
    return this.repo.findOne({
      where: { tenantId, id },
      relations: ['items', 'unidades'],
    });
  }

  async listar(tenantId: string, q: QueryTransferenciasDto) {
    const page = Number(q.page ?? 1);
    const limit = Math.min(Number(q.limit ?? 50), 200);
    const skip = (page - 1) * limit;

    if (q.desde && q.hasta && q.desde > q.hasta) {
      throw new BadRequestException('desde no puede ser mayor que hasta');
    }

    const qb = this.repo
      .createQueryBuilder('t')
      .where('t.tenant_id = :tenantId', { tenantId })

      // joins principales
      .leftJoinAndSelect('t.origenDeposito', 'origen')
      .leftJoinAndSelect('t.destinoDeposito', 'destino')
      .leftJoinAndSelect('t.responsable', 'resp')

      // ✅ traer items
      .leftJoinAndSelect('t.items', 'it')
      .leftJoinAndSelect('it.loteMp', 'itLoteMp')
      .leftJoinAndSelect('it.lotePf', 'itLotePf')
      .leftJoinAndSelect('it.presentacion', 'itPres')
      .leftJoinAndSelect('it.lotePfOrigen', 'itLotePfOri')

      // ✅ traer unidades (si es PF_ENVASADO)
      .leftJoinAndSelect('t.unidades', 'tu')
      .leftJoinAndSelect('tu.unidad', 'unidad')
      .leftJoinAndSelect('unidad.loteOrigen', 'unidadLoteOrigen')
      .leftJoinAndSelect('unidad.presentacion', 'unidadPres')
      .leftJoinAndSelect('unidad.deposito', 'unidadDep');

    // ==========================
    // Filtros directos (cabecera)
    // ==========================
    if (q.tipo) qb.andWhere('t.tipo = :tipo', { tipo: q.tipo });
    if (q.estado) qb.andWhere('t.estado = :estado', { estado: q.estado });
    if (q.origenDepositoId)
      qb.andWhere('origen.id = :oid', { oid: q.origenDepositoId });
    if (q.destinoDepositoId)
      qb.andWhere('destino.id = :did', { did: q.destinoDepositoId });
    if (q.responsableId)
      qb.andWhere('resp.id = :rid', { rid: q.responsableId });

    // rango por fecha de negocio (t.fecha, type=date)
    if (q.desde) qb.andWhere('t.fecha >= :desde', { desde: q.desde });
    if (q.hasta) qb.andWhere('t.fecha <= :hasta', { hasta: q.hasta });

    // ==========================
    // Filtros por ítems
    // (requieren que exista al menos un item que cumpla)
    // ==========================
    if (q.loteMpId) qb.andWhere('itLoteMp.id = :lmp', { lmp: q.loteMpId });
    if (q.lotePfId) qb.andWhere('itLotePf.id = :lpf', { lpf: q.lotePfId });
    if (q.presentacionId)
      qb.andWhere('itPres.id = :pid', { pid: q.presentacionId });
    if (q.lotePfOrigenId)
      qb.andWhere('itLotePfOri.id = :lpo', { lpo: q.lotePfOrigenId });

    // ==========================
    // Búsqueda libre
    // ==========================
    if (q.q && q.q.trim().length) {
      const term = `%${q.q.trim()}%`;
      qb.andWhere(
        new Brackets((b) => {
          b.where('t.observaciones ILIKE :term', { term })
            .orWhere('it.descripcion ILIKE :term', { term })

            // códigos de lotes (si existen en esas entidades)
            .orWhere('itLoteMp.codigoLote ILIKE :term', { term })
            .orWhere('itLotePf.codigoLote ILIKE :term', { term })
            .orWhere('itLotePfOri.codigoLote ILIKE :term', { term })

            // código etiqueta de unidad envasada
            .orWhere('unidad.codigoEtiqueta ILIKE :term', { term });
        }),
      );
    }

    // ==========================
    // Orden
    // ==========================
    const sortBy = q.sortBy ?? 'createdAt';
    const sortDir = (q.sortDir ?? 'DESC').toUpperCase() as 'ASC' | 'DESC';

    if (sortBy === 'fecha') {
      qb.orderBy('t.fecha', sortDir);
    } else {
      qb.orderBy('t.createdAt', sortDir);
    }

    // para que sea estable con joins
    qb.addOrderBy('t.id', 'DESC');

    // ==========================
    // Paginado
    // ⚠️ Con joins 1-N, getManyAndCount cuenta duplicados.
    // Solución: paginar por IDs (2 pasos).
    // ==========================
    const idsQb = this.repo
      .createQueryBuilder('t')
      .select('t.id', 'id')
      .where('t.tenant_id = :tenantId', { tenantId });

    // replicar los mismos filtros en el idsQb (sin joins pesados)
    if (q.tipo) idsQb.andWhere('t.tipo = :tipo', { tipo: q.tipo });
    if (q.estado) idsQb.andWhere('t.estado = :estado', { estado: q.estado });
    if (q.desde) idsQb.andWhere('t.fecha >= :desde', { desde: q.desde });
    if (q.hasta) idsQb.andWhere('t.fecha <= :hasta', { hasta: q.hasta });

    if (q.origenDepositoId) {
      idsQb
        .leftJoin('t.origenDeposito', 'origen')
        .andWhere('origen.id = :oid', { oid: q.origenDepositoId });
    }
    if (q.destinoDepositoId) {
      idsQb
        .leftJoin('t.destinoDeposito', 'destino')
        .andWhere('destino.id = :did', { did: q.destinoDepositoId });
    }
    if (q.responsableId) {
      idsQb
        .leftJoin('t.responsable', 'resp')
        .andWhere('resp.id = :rid', { rid: q.responsableId });
    }

    // filtros por items → EXISTS (sin traer todo)
    if (
      q.loteMpId ||
      q.lotePfId ||
      q.presentacionId ||
      q.lotePfOrigenId ||
      (q.q && q.q.trim().length)
    ) {
      idsQb.andWhere(
        new Brackets((b) => {
          // EXISTS items
          const term = q.q?.trim()?.length ? `%${q.q.trim()}%` : null;

          b.where(
            `EXISTS (
              SELECT 1
              FROM transferencia_items itx
              WHERE itx.tenant_id = t.tenant_id
                AND itx.transferencia_id = t.id
                ${q.loteMpId ? 'AND itx.lote_mp_id = :lmp' : ''}
                ${q.lotePfId ? 'AND itx.lote_pf_id = :lpf' : ''}
                ${q.presentacionId ? 'AND itx.presentacion_id = :pid' : ''}
                ${q.lotePfOrigenId ? 'AND itx.lote_pf_origen_id = :lpo' : ''}
                ${
                  term
                    ? `AND (
                        itx.descripcion ILIKE :term
                        OR EXISTS (SELECT 1 FROM lotes_mp lmp WHERE lmp.id = itx.lote_mp_id AND lmp.codigo_lote ILIKE :term)
                        OR EXISTS (SELECT 1 FROM lotes_pf lpf WHERE lpf.id = itx.lote_pf_id AND lpf.codigo_lote ILIKE :term)
                        OR EXISTS (SELECT 1 FROM lotes_pf lpo WHERE lpo.id = itx.lote_pf_origen_id AND lpo.codigo_lote ILIKE :term)
                      )`
                    : ''
                }
            )`,
          );

          // OR buscar en unidades
          if (term) {
            b.orWhere(
              `EXISTS (
                SELECT 1
                FROM transferencia_unidades tux
                JOIN pf_unidades_envasadas u ON u.id = tux.unidad_id
                WHERE tux.tenant_id = t.tenant_id
                  AND tux.transferencia_id = t.id
                  AND u.codigo_etiqueta ILIKE :term
              )`,
            );
          }
        }),
      );

      if (q.loteMpId) idsQb.setParameter('lmp', q.loteMpId);
      if (q.lotePfId) idsQb.setParameter('lpf', q.lotePfId);
      if (q.presentacionId) idsQb.setParameter('pid', q.presentacionId);
      if (q.lotePfOrigenId) idsQb.setParameter('lpo', q.lotePfOrigenId);
      if (q.q && q.q.trim().length)
        idsQb.setParameter('term', `%${q.q.trim()}%`);
    }

    if (sortBy === 'fecha') idsQb.orderBy('t.fecha', sortDir);
    else idsQb.orderBy('t.created_at', sortDir); // idsQb es "raw", ok
    idsQb.addOrderBy('t.id', 'DESC');

    const total = await idsQb.getCount();

    const ids = (await idsQb.offset(skip).limit(limit).getRawMany()) as {
      id: string;
    }[];
    const idList = ids.map((r) => r.id);

    if (!idList.length) {
      return { page, limit, total, items: [] };
    }

    // traer data completa (con joins) para esos ids
    qb.andWhere('t.id IN (:...ids)', { ids: idList });

    // mantener el orden del paginado
    // Postgres: ORDER BY array_position
    qb.orderBy(`array_position(ARRAY[:...ids]::uuid[], t.id)`, 'ASC');

    const data = await qb.getMany();

    return {
      page,
      limit,
      total,
      items: data,
    };
  }

  // =========================
  // Confirmar
  // =========================
  async confirmar(tenantId: string, usuarioId: string | null, id: string) {
    return this.ds.transaction(async (trx) => {
      const repo = trx.getRepository(Transferencia);
      const itemRepo = trx.getRepository(TransferenciaItem);
      const tuRepo = trx.getRepository(TransferenciaUnidad);

      const depRepo = trx.getRepository(Deposito);
      const loteMpRepo = trx.getRepository(LoteMP);
      const lotePfRepo = trx.getRepository(LoteProductoFinal);
      const presRepo = trx.getRepository(PresentacionProductoFinal);
      const unidadRepo = trx.getRepository(PFUnidadEnvasada);
      const stockPresRepo = trx.getRepository(StockPresentacion);
      const movRepo = trx.getRepository(StockMovimiento);

      const t = await repo.findOne({
        where: { tenantId, id },
        relations: [
          'origenDeposito',
          'destinoDeposito',
          'items',
          'items.loteMp',
          'items.lotePf',
          'items.presentacion',
        ],
      });
      if (!t) throw new NotFoundException('Transferencia no encontrada');
      if (t.estado !== TransferenciaEstado.BORRADOR) {
        throw new BadRequestException(
          'Solo se puede confirmar una transferencia en BORRADOR',
        );
      }

      const origen = await depRepo.findOne({
        where: { tenantId, id: t.origenDeposito.id },
      });
      const destino = await depRepo.findOne({
        where: { tenantId, id: t.destinoDeposito.id },
      });
      if (!origen || !destino)
        throw new NotFoundException('Depósitos inválidos');

      if (!t.items?.length)
        throw new BadRequestException('La transferencia no tiene items');

      // =====================
      // MP (move o split)
      // =====================
      if (t.tipo === TransferenciaTipo.MP) {
        for (const it of t.items) {
          const kg = dec(it.cantidadKg);

          if (!it.loteMp?.id)
            throw new BadRequestException('MP requiere loteMpId');
          if (kg <= 0)
            throw new BadRequestException('cantidadKg requerida para MP');

          // lock lote
          const lote = await loteMpRepo.findOne({
            where: { tenantId, id: it.loteMp.id },
            lock: { mode: 'pessimistic_write' },
            loadEagerRelations: false,
          });
          if (!lote) throw new NotFoundException('Lote MP no encontrado');

          // raw fks (deposito_id, recepcion_id, materia_prima_id)
          const raw = await loteMpRepo
            .createQueryBuilder('l')
            .select([
              'l.codigo_lote AS codigo_lote',
              'l.deposito_id AS deposito_id',
              'l.recepcion_id AS recepcion_id',
              'l.materia_prima_id AS materia_prima_id',
            ])
            .where('l.tenant_id = :tenantId', { tenantId })
            .andWhere('l.id = :id', { id: it.loteMp.id })
            .getRawOne<{
              codigo_lote: string;
              deposito_id: string;
              recepcion_id: string;
              materia_prima_id: string;
            }>();

          if (!raw) throw new NotFoundException('Lote MP no encontrado');

          if (raw.deposito_id !== origen.id) {
            throw new BadRequestException(
              `El lote MP ${raw.codigo_lote ?? lote.codigoLote} no pertenece al depósito origen`,
            );
          }

          const disp = dec(lote.cantidadActualKg);
          if (disp < kg) {
            throw new BadRequestException(
              `Stock insuficiente en lote MP ${raw.codigo_lote ?? lote.codigoLote} (disp ${disp}, req ${kg})`,
            );
          }

          const isMove = disp === kg;

          if (isMove) {
            // MOVE: mismo lote cambia de depósito
            (lote as any).deposito = { id: destino.id } as any;
            await loteMpRepo.save(lote);

            await movRepo.save(
              movRepo.create({
                tenantId,
                tipo: TipoMovimiento.TRANSFERENCIA_MP as any,
                loteMP: { id: lote.id } as any,
                deposito: { id: origen.id } as any,
                cantidadKg: -kg,
                referenciaId: t.id,
              }),
            );

            await movRepo.save(
              movRepo.create({
                tenantId,
                tipo: TipoMovimiento.TRANSFERENCIA_MP as any,
                loteMP: { id: lote.id } as any,
                deposito: { id: destino.id } as any,
                cantidadKg: +kg,
                referenciaId: t.id,
              }),
            );

            it.descripcion =
              it.descripcion ??
              `Move: ${raw.codigo_lote ?? lote.codigoLote} -> depósito destino`;
            await itemRepo.save(it);
          } else {
            // SPLIT: descuenta y crea hijo
            lote.cantidadActualKg = disp - kg;
            await loteMpRepo.save(lote);

            const loteDestino = await this.crearLoteMpSplitConRetry(
              trx,
              tenantId,
              raw.codigo_lote ?? lote.codigoLote,
              {
                recepcion_id: raw.recepcion_id,
                materia_prima_id: raw.materia_prima_id,
              },
              destino.id,
              lote,
              kg,
              t.id,
            );

            await movRepo.save(
              movRepo.create({
                tenantId,
                tipo: TipoMovimiento.TRANSFERENCIA_MP as any,
                loteMP: { id: lote.id } as any,
                deposito: { id: origen.id } as any,
                cantidadKg: -kg,
                referenciaId: t.id,
              }),
            );

            await movRepo.save(
              movRepo.create({
                tenantId,
                tipo: TipoMovimiento.TRANSFERENCIA_MP as any,
                loteMP: { id: loteDestino.id } as any,
                deposito: { id: destino.id } as any,
                cantidadKg: +kg,
                referenciaId: t.id,
              }),
            );

            it.descripcion =
              it.descripcion ??
              `Split: ${raw.codigo_lote ?? lote.codigoLote} -> ${loteDestino.codigoLote}`;
            await itemRepo.save(it);
          }
        }
      }

      // =====================
      // PF granel (move o split)
      // =====================
      if (t.tipo === TransferenciaTipo.PF_GRANEL) {
        for (const it of t.items) {
          const kg = dec(it.cantidadKg);

          if (!it.lotePf?.id)
            throw new BadRequestException('PF_GRANEL requiere lotePfId');
          if (kg <= 0)
            throw new BadRequestException(
              'cantidadKg requerida para PF_GRANEL',
            );

          const lote = await lotePfRepo.findOne({
            where: { tenantId, id: it.lotePf.id },
            lock: { mode: 'pessimistic_write' },
            loadEagerRelations: false,
          });
          if (!lote) throw new NotFoundException('Lote PF no encontrado');

          const raw = await lotePfRepo
            .createQueryBuilder('l')
            .select([
              'l.id AS id',
              'l.codigo_lote AS codigo_lote',
              'l.deposito_id AS deposito_id',
              'l.producto_final_id AS producto_final_id',
              'l.fecha_produccion AS fecha_produccion',
              'l.fecha_vencimiento AS fecha_vencimiento',
              'l.estado AS estado',
            ])
            .where('l.tenant_id = :tenantId', { tenantId })
            .andWhere('l.id = :id', { id: it.lotePf.id })
            .getRawOne<{
              id: string;
              codigo_lote: string;
              deposito_id: string;
              producto_final_id: string;
              fecha_produccion: Date | string;
              fecha_vencimiento: Date | string | null;
              estado: LotePfEstado | string | null;
            }>();

          if (!raw) throw new NotFoundException('Lote PF no encontrado');

          if (raw.deposito_id !== origen.id) {
            throw new BadRequestException(
              `El lote PF ${raw.codigo_lote} no pertenece al depósito origen`,
            );
          }

          if (raw.estado && raw.estado !== LotePfEstado.LISTO) {
            throw new BadRequestException(
              `El lote ${raw.codigo_lote} no está LISTO (estado: ${raw.estado})`,
            );
          }

          if (!raw.producto_final_id) {
            throw new BadRequestException(
              `El lote PF ${raw.codigo_lote} no tiene producto_final_id (datos inconsistentes)`,
            );
          }

          const disp = dec(lote.cantidadActualKg);
          if (disp < kg) {
            throw new BadRequestException(
              `Stock insuficiente en lote PF ${raw.codigo_lote} (disp ${disp}, req ${kg})`,
            );
          }

          const isMove = disp === kg;

          if (isMove) {
            (lote as any).deposito = { id: destino.id } as any;
            await lotePfRepo.save(lote);

            await movRepo.save(
              movRepo.create({
                tenantId,
                tipo: TipoMovimiento.TRANSFERENCIA_PF as any,
                lotePF: { id: lote.id } as any,
                deposito: { id: origen.id } as any,
                cantidadKg: -kg,
                referenciaId: t.id,
              }),
            );

            await movRepo.save(
              movRepo.create({
                tenantId,
                tipo: TipoMovimiento.TRANSFERENCIA_PF as any,
                lotePF: { id: lote.id } as any,
                deposito: { id: destino.id } as any,
                cantidadKg: +kg,
                referenciaId: t.id,
              }),
            );

            it.cantidadKg = kg;
            it.descripcion =
              it.descripcion ?? `Move: ${raw.codigo_lote} -> depósito destino`;
            await itemRepo.save(it);
          } else {
            // split
            lote.cantidadActualKg = disp - kg;
            await lotePfRepo.save(lote);

            const loteDestino = await this.crearLotePfSplitConRetry(
              trx,
              tenantId,
              raw.codigo_lote,
              raw,
              destino.id,
              kg,
              t.id,
            );

            await movRepo.save(
              movRepo.create({
                tenantId,
                tipo: TipoMovimiento.TRANSFERENCIA_PF as any,
                lotePF: { id: lote.id } as any,
                deposito: { id: origen.id } as any,
                cantidadKg: -kg,
                referenciaId: t.id,
              }),
            );

            await movRepo.save(
              movRepo.create({
                tenantId,
                tipo: TipoMovimiento.TRANSFERENCIA_PF as any,
                lotePF: { id: loteDestino.id } as any,
                deposito: { id: destino.id } as any,
                cantidadKg: +kg,
                referenciaId: t.id,
              }),
            );

            it.cantidadKg = kg;
            it.descripcion =
              it.descripcion ??
              `Split: ${raw.codigo_lote} -> ${loteDestino.codigoLote}`;
            await itemRepo.save(it);
          }
        }
      }

      // =====================
      // PF envasado (move unidades)
      // =====================
      if (t.tipo === TransferenciaTipo.PF_ENVASADO) {
        for (const it of t.items) {
          if (!it.presentacion?.id) {
            throw new BadRequestException(
              'PF_ENVASADO requiere presentacionId',
            );
          }

          const pres = await presRepo.findOne({
            where: { tenantId, id: it.presentacion.id },
            relations: ['productoFinal'],
          });
          if (!pres) throw new NotFoundException('Presentación no encontrada');
          if (pres.unidadVenta === UnidadVenta.KG) {
            throw new BadRequestException(
              'PF_ENVASADO es solo para presentaciones por UNIDAD/BULTO, no KG',
            );
          }

          const cant = Number(it.cantidadUnidades ?? 0);
          if (!Number.isFinite(cant) || cant <= 0) {
            throw new BadRequestException(
              'cantidadUnidades requerida para PF_ENVASADO',
            );
          }

          const qb = unidadRepo
            .createQueryBuilder('u')
            .setLock('pessimistic_write')
            .innerJoinAndSelect('u.loteOrigen', 'l')
            .where('u.tenant_id = :tenantId', { tenantId })
            .andWhere('u.presentacion_id = :pid', { pid: pres.id })
            .andWhere('u.deposito_id = :did', { did: origen.id })
            .andWhere('u.estado = :estado', { estado: 'DISPONIBLE' });

          if (it.lotePfOrigen?.id) {
            qb.andWhere('u.lote_pf_origen_id = :loteId', {
              loteId: it.lotePfOrigen.id,
            });
          }

          const unidades = await qb
            .orderBy('l.fechaVencimiento', 'ASC', 'NULLS LAST')
            .addOrderBy('l.fechaProduccion', 'ASC')
            .addOrderBy('u.createdAt', 'ASC')
            .take(cant)
            .getMany();

          if (unidades.length < cant) {
            const extra = it.lotePfOrigen?.id
              ? ` para el lote ${it.lotePfOrigen.id}`
              : '';
            throw new BadRequestException(
              `Stock insuficiente de unidades envasadas${extra} (req ${cant}, disp ${unidades.length})`,
            );
          }

          // mover unidades: cambia depósito
          for (const u of unidades) {
            (u as any).deposito = { id: destino.id } as any;
          }
          await unidadRepo.save(unidades);

          // detalle en transferencia_unidades
          for (const u of unidades) {
            await tuRepo.save(
              tuRepo.create({
                tenantId,
                transferencia: { id: t.id } as any,
                unidad: { id: u.id } as any,
              }),
            );
          }

          // lock de stock presentaciones en orden determinístico (evita deadlocks cruzados)
          const [depA, depB] =
            origen.id < destino.id ? [origen, destino] : [destino, origen];

          const stockA = await stockPresRepo.findOne({
            where: {
              tenantId,
              presentacion: { id: pres.id } as any,
              deposito: { id: depA.id } as any,
            },
            lock: { mode: 'pessimistic_write' },
            loadEagerRelations: false,
          });

          const stockB = await stockPresRepo.findOne({
            where: {
              tenantId,
              presentacion: { id: pres.id } as any,
              deposito: { id: depB.id } as any,
            },
            lock: { mode: 'pessimistic_write' },
            loadEagerRelations: false,
          });

          const so =
            stockA && depA.id === origen.id
              ? stockA
              : stockB && depB.id === origen.id
                ? stockB
                : null;

          const sd =
            stockA && depA.id === destino.id
              ? stockA
              : stockB && depB.id === destino.id
                ? stockB
                : null;

          const stockOrigen =
            so ??
            stockPresRepo.create({
              tenantId,
              presentacion: pres,
              deposito: origen,
              stockKg: 0,
              stockUnidades: 0,
            });

          const stockDestino =
            sd ??
            stockPresRepo.create({
              tenantId,
              presentacion: pres,
              deposito: destino,
              stockKg: 0,
              stockUnidades: 0,
            });

          stockOrigen.stockUnidades = dec(stockOrigen.stockUnidades) - cant;
          stockDestino.stockUnidades = dec(stockDestino.stockUnidades) + cant;

          if (dec(stockOrigen.stockUnidades) < 0) {
            throw new BadRequestException(
              'StockPresentacion origen quedó negativo (desincronización)',
            );
          }

          await stockPresRepo.save([stockOrigen, stockDestino]);

          let kgTotal = 0;
          const mapKg = new Map<string, { unidades: number; kg: number }>();

          for (const u of unidades) {
            const lid = (u.loteOrigen as any)?.id;
            if (!lid)
              throw new BadRequestException('Unidad envasada sin loteOrigen');

            const w = dec((u as any).pesoKg ?? pres.pesoPorUnidadKg);
            kgTotal += w;

            const cur = mapKg.get(lid) ?? { unidades: 0, kg: 0 };
            cur.unidades += 1;
            cur.kg += w;
            mapKg.set(lid, cur);
          }

          for (const [loteId, info] of mapKg.entries()) {
            await movRepo.save(
              movRepo.create({
                tenantId,
                tipo: TipoMovimiento.TRANSFERENCIA_ENVASADO as any,
                lotePF: { id: loteId } as any,
                deposito: { id: origen.id } as any,
                presentacion: { id: pres.id } as any,
                cantidadKg: -info.kg,
                cantidadUnidades: info.unidades,
                referenciaId: t.id,
              }),
            );
            await movRepo.save(
              movRepo.create({
                tenantId,
                tipo: TipoMovimiento.TRANSFERENCIA_ENVASADO as any,
                lotePF: { id: loteId } as any,
                deposito: { id: destino.id } as any,
                presentacion: { id: pres.id } as any,
                cantidadKg: +info.kg,
                cantidadUnidades: info.unidades,
                referenciaId: t.id,
              }),
            );
          }

          it.presentacion = pres;
          it.cantidadUnidades = cant;
          it.cantidadKg = kgTotal;
          await itemRepo.save(it);
        }
      }

      t.estado = TransferenciaEstado.CONFIRMADA;
      await repo.save(t);

      return repo.findOne({
        where: { tenantId, id: t.id },
        relations: ['items', 'unidades', 'origenDeposito', 'destinoDeposito'],
      });
    });
  }

  // ============================================================
  // Helpers robustos split (reintento por unique en codigo_lote)
  // ============================================================

  private async crearLoteMpSplitConRetry(
    trx: any,
    tenantId: string,
    codigoBase: string,
    fks: { recepcion_id: string; materia_prima_id: string },
    destinoDepositoId: string,
    lotePadre: LoteMP,
    kg: number,
    transferenciaId: string,
  ) {
    const repo = trx.getRepository(LoteMP);

    for (let intento = 1; intento <= 5; intento++) {
      const codigoHijo = await this.generarCodigoSplit(
        trx,
        tenantId,
        codigoBase,
        'MP',
      );

      try {
        const nuevo = repo.create({
          tenantId,
          recepcion: { id: fks.recepcion_id } as any,
          materiaPrima: { id: fks.materia_prima_id } as any,
          deposito: { id: destinoDepositoId } as any,
          codigoLote: codigoHijo,
          fechaElaboracion: (lotePadre as any).fechaElaboracion,
          fechaAnalisis: (lotePadre as any).fechaAnalisis ?? null,
          fechaVencimiento: (lotePadre as any).fechaVencimiento,
          cantidadInicialKg: kg,
          cantidadActualKg: kg,
          analisis: (lotePadre as any).analisis ?? null,
          documentos: (lotePadre as any).documentos ?? null,
        });

        return await repo.save(nuevo);
      } catch (e) {
        if (isPgUniqueViolation(e) && intento < 5) continue;
        throw e;
      }
    }

    throw new BadRequestException(
      `No se pudo generar codigo split MP para ${codigoBase} (colisión repetida)`,
    );
  }

  private async crearLotePfSplitConRetry(
    trx: any,
    tenantId: string,
    codigoBase: string,
    raw: {
      codigo_lote: string;
      producto_final_id: string;
      fecha_produccion: Date | string;
      fecha_vencimiento: Date | string | null;
    },
    destinoDepositoId: string,
    kg: number,
    transferenciaId: string,
  ) {
    const repo = trx.getRepository(LoteProductoFinal);

    for (let intento = 1; intento <= 5; intento++) {
      const codigoHijo = await this.generarCodigoSplit(
        trx,
        tenantId,
        codigoBase,
        'PF',
      );

      try {
        const nuevo = repo.create({
          tenantId,
          codigoLote: codigoHijo,
          cantidadInicialKg: kg,
          cantidadActualKg: kg,
          deposito: { id: destinoDepositoId } as any,
          fechaProduccion: raw.fecha_produccion as any,
          fechaVencimiento: (raw.fecha_vencimiento ?? null) as any,
          estado: LotePfEstado.LISTO,
          motivoEstado: `Split desde ${raw.codigo_lote} por transferencia ${transferenciaId}`,
          fechaEstado: new Date(),
          productoFinal: { id: raw.producto_final_id } as any,
        });

        return await repo.save(nuevo);
      } catch (e) {
        if (isPgUniqueViolation(e) && intento < 5) continue;
        throw e;
      }
    }

    throw new BadRequestException(
      `No se pudo generar codigo split PF para ${codigoBase} (colisión repetida)`,
    );
  }

  // ============================================================
  // Código split genérico (MP/PF)
  // ============================================================
  private async generarCodigoSplit(
    trx: any,
    tenantId: string,
    codigoBase: string,
    pref: 'PF' | 'MP',
  ) {
    const repo =
      pref === 'PF'
        ? trx.getRepository(LoteProductoFinal)
        : trx.getRepository(LoteMP);

    const base = `${codigoBase}-T`;
    const existing = (await repo
      .createQueryBuilder('l')
      .select('l.codigo_lote', 'codigo')
      .where('l.tenant_id = :tenantId', { tenantId })
      .andWhere('l.codigo_lote LIKE :p', { p: `${base}%` })
      .getRawMany()) as { codigo: string }[];

    let max = 0;
    for (const r of existing) {
      const c = r.codigo ?? '';
      const m = c.match(/-T(\d+)$/);
      if (m?.[1]) max = Math.max(max, Number(m[1]));
    }
    const next = String(max + 1).padStart(4, '0');
    return `${base}${next}`;
  }
}
