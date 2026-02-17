import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Empaque } from './entities/empaque.entity';
import { EmpaqueItem } from './entities/empaque-item.entity';
import { StockPresentacion } from './entities/stock-presentacion.entity';
import { PFUnidadEnvasada } from './entities/pf-unidad-envasada.entity';
import { CreateEmpaqueDto } from './dto/create-empaque.dto';
import { AddEmpaqueItemDto } from './dto/add-empaque-item.dto';
import { QueryEmpaquesDto } from './dto/query-empaques.dto';
import { LoteProductoFinal } from '../lotes/entities/lote-producto-final.entity';
import { Deposito } from '../deposito/entities/deposito.entity';
import {
  PresentacionProductoFinal,
  UnidadVenta,
} from '../producto-final/entities/presentacion-producto-final.entity';
import {
  StockMovimiento,
  TipoMovimiento,
} from '../stock-movimiento/entities/stock-movimiento.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Insumo } from '../insumo/entities/insumo.entity';
import { InsumoMovimiento, TipoMovimientoInsumo } from '../insumo/entities/insumo-movimiento.entity';

import { InsumoConsumoPfService } from '../insumo/insumo-consumo-pf.service';

import { QueryUnidadesEnvasadasDto } from './dto/query-unidades-envasadas.dto';
import { DescartarUnidadesLoteDto } from './dto/descartar-unidades-lote.dto';


type GrupoKey = { loteId: string; presentacionId: string; depositoId: string };

function keyOf(g: GrupoKey) {
  return `${g.loteId}::${g.presentacionId}::${g.depositoId}`;
}

function dec(n: any) {
  const v = Number(n);
  if (Number.isNaN(v)) return 0;
  return v;
}


function parseBool(v: any, def = false): boolean {
  if (v === true || v === false) return v;
  if (v === null || v === undefined) return def;

  const s = String(v).trim().toLowerCase();
  if (['true', '1', 'yes', 'si'].includes(s)) return true;
  if (['false', '0', 'no'].includes(s)) return false;

  return def;
}


@Injectable()
export class EmpaquesService {
  constructor(
    private ds: DataSource,
    @InjectRepository(Empaque) private empaqueRepo: Repository<Empaque>,
    @InjectRepository(EmpaqueItem) private itemRepo: Repository<EmpaqueItem>,
    @InjectRepository(StockPresentacion)
    private stockPresRepo: Repository<StockPresentacion>,
    @InjectRepository(PFUnidadEnvasada)
    private unidadRepo: Repository<PFUnidadEnvasada>,
    @InjectRepository(LoteProductoFinal)
    private lotePFRepo: Repository<LoteProductoFinal>,
    @InjectRepository(Deposito) private depRepo: Repository<Deposito>,
    @InjectRepository(PresentacionProductoFinal)
    private presRepo: Repository<PresentacionProductoFinal>,
    @InjectRepository(StockMovimiento)
    private movRepo: Repository<StockMovimiento>,
    private auditoria: AuditoriaService,
    private insumoConsumoService: InsumoConsumoPfService,
  ) {}

  async crear(tenantId: string, usuarioId: string, dto: CreateEmpaqueDto) {
    const lote = await this.lotePFRepo.findOne({
      where: { id: dto.lotePfId, tenantId },
    });
    if (!lote) throw new NotFoundException('Lote PF no encontrado');

    const deposito = await this.depRepo.findOne({
      where: { id: dto.depositoId, tenantId },
    });
    if (!deposito) throw new NotFoundException('Depósito no encontrado');

    const empaque = this.empaqueRepo.create({
      tenantId,
      lote,
      deposito,
      responsable: { id: dto.responsableId } as any,
      fecha: new Date(dto.fecha),
      estado: 'BORRADOR',
      observaciones: dto.observaciones ?? null,
      items: [],
    });

    const saved = await this.empaqueRepo.save(empaque);

    await this.auditoria.registrar(tenantId, usuarioId, 'EMPAQUE_CREADO', {
      empaqueId: saved.id,
    });

    return this.obtener(tenantId, saved.id);
  }

  async agregarItem(
    tenantId: string,
    usuarioId: string,
    empaqueId: string,
    dto: AddEmpaqueItemDto,
  ) {
    const empaque = await this.empaqueRepo.findOne({
      where: { id: empaqueId, tenantId },
      relations: ['items', 'lote', 'deposito'],
    });
    if (!empaque) throw new NotFoundException('Empaque no encontrado');

    if (empaque.estado !== 'BORRADOR') {
      throw new BadRequestException('Solo se pueden agregar items en BORRADOR');
    }

    const pres = await this.presRepo.findOne({
      where: { id: dto.presentacionId, tenantId },
    });
    if (!pres) throw new NotFoundException('Presentación no encontrada');

    // Validación BULTO/UNIDAD: requiere pesoPorUnidadKg
    if (pres.unidadVenta !== UnidadVenta.KG) {
      const peso = dec(pres.pesoPorUnidadKg);
      if (!peso || peso <= 0) {
        throw new BadRequestException(
          `Presentación ${pres.codigo} requiere pesoPorUnidadKg`,
        );
      }
    }

    const item = this.itemRepo.create({
      tenantId,
      empaque,
      presentacion: pres,
      cantidadKg: dto.cantidadKg,
      cantidadUnidades: null,
    });

    await this.itemRepo.save(item);

    await this.auditoria.registrar(
      tenantId,
      usuarioId,
      'EMPAQUE_ITEM_AGREGADO',
      {
        empaqueId,
        presentacionId: pres.id,
        cantidadKg: dto.cantidadKg,
      },
    );

    return this.obtener(tenantId, empaqueId);
  }

  async quitarItem(
    tenantId: string,
    usuarioId: string,
    empaqueId: string,
    itemId: string,
  ) {
    const empaque = await this.empaqueRepo.findOne({
      where: { id: empaqueId, tenantId },
    });
    if (!empaque) throw new NotFoundException('Empaque no encontrado');

    if (empaque.estado !== 'BORRADOR') {
      throw new BadRequestException('Solo se pueden quitar items en BORRADOR');
    }

    const item = await this.itemRepo.findOne({
      where: { id: itemId, tenantId },
      relations: ['empaque'],
    });
    if (!item || item.empaque?.id !== empaqueId)
      throw new NotFoundException('Item no encontrado');

    await this.itemRepo.delete({ id: itemId, tenantId });

    await this.auditoria.registrar(
      tenantId,
      usuarioId,
      'EMPAQUE_ITEM_QUITADO',
      { empaqueId, itemId },
    );

    return this.obtener(tenantId, empaqueId);
  }

  async confirmar(tenantId: string, usuarioId: string, empaqueId: string) {
    return this.ds.transaction(async (trx) => {
      const empaqueRepo = trx.getRepository(Empaque);
      const itemRepo = trx.getRepository(EmpaqueItem);
      const loteRepo = trx.getRepository(LoteProductoFinal);
      const stockPresRepo = trx.getRepository(StockPresentacion);
      const unidadRepo = trx.getRepository(PFUnidadEnvasada);
      const movRepo = trx.getRepository(StockMovimiento);

      // ✅ NUEVO (insumos globales)
      const insumoRepo = trx.getRepository(Insumo);
      const insumoMovRepo = trx.getRepository(InsumoMovimiento);

      const empaque = await empaqueRepo.findOne({
        where: { id: empaqueId, tenantId },
        // ✅ agregado lote.productoFinal SOLO para poder calcular reglas por PF
        relations: [
          'items',
          'items.presentacion',
          'lote',
          'lote.productoFinal',
          'deposito',
          'responsable',
        ],
      });
      if (!empaque) throw new NotFoundException('Empaque no encontrado');

      if (empaque.estado !== 'BORRADOR') {
        throw new BadRequestException(
          'Solo se puede confirmar un empaque en BORRADOR',
        );
      }

      const items = empaque.items ?? [];
      if (!items.length)
        throw new BadRequestException('El empaque no tiene items');

      // 1) Validar total kg a consumir
      const totalKg = items.reduce((acc, it) => acc + dec(it.cantidadKg), 0);
      const disponible = dec(empaque.lote.cantidadActualKg);

      if (totalKg <= 0)
        throw new BadRequestException('Total a empaquetar debe ser > 0');
      if (disponible < totalKg) {
        throw new BadRequestException(
          `Stock insuficiente en lote ${empaque.lote.codigoLote} (disponible ${disponible}, requerido ${totalKg})`,
        );
      }

      // 2) Descontar del lote PF (granel)
      empaque.lote.cantidadActualKg = disponible - totalKg;
      await loteRepo.save(empaque.lote);

      // Movimiento: consumo PF por empaque (granel)
      await movRepo.save(
        movRepo.create({
          tenantId,
          tipo: TipoMovimiento.EMPAQUE_CONSUMO_PF,
          lotePF: empaque.lote,
          deposito: empaque.lote.deposito, // sale del depósito del lote
          cantidadKg: -totalKg,
          referenciaId: empaque.id,
        }),
      );

      const productoFinalId =
        (empaque.lote as any)?.productoFinal?.id ??
        (empaque.lote as any)?.productoFinalId ??
        null;

      // 3) Por cada item: sumar stock presentación y (si aplica) generar unidades etiquetadas
      for (const it of items) {
        const pres = it.presentacion as PresentacionProductoFinal;
        const kg = dec(it.cantidadKg);

        // Buscar/crear stock_presentaciones (presentacion + deposito del empaque)
        let stock = await stockPresRepo.findOne({
          where: {
            tenantId,
            presentacion: { id: pres.id } as any,
            deposito: { id: empaque.deposito.id } as any,
          },
        });

        if (!stock) {
          stock = stockPresRepo.create({
            tenantId,
            presentacion: pres,
            deposito: empaque.deposito,
            stockKg: 0,
            stockUnidades: 0,
          });
        }

        // unidadVenta = KG => solo kg, no unidades etiquetadas
        if (pres.unidadVenta === UnidadVenta.KG) {
          stock.stockKg = dec(stock.stockKg) + kg;

          await stockPresRepo.save(stock);

          await movRepo.save(
            movRepo.create({
              tenantId,
              tipo: TipoMovimiento.EMPAQUE_INGRESO_PRES,
              lotePF: empaque.lote,
              deposito: empaque.deposito,
              presentacion: pres,
              cantidadKg: kg,
              cantidadUnidades: null,
              referenciaId: empaque.id,
            }),
          );

          it.cantidadUnidades = null;
          await itemRepo.save(it);

          // ============================
          // ✅ NUEVO: CONSUMO INSUMOS (para KG también)
          // ============================
          const consumos = await this.insumoConsumoService.calcularConsumo(
            tenantId,
            {
              productoFinalId: productoFinalId ?? undefined,
              presentacionId: pres.id,
              unidades: 0,
              kg,
            },
          );

          const aConsumir = consumos.filter(
            (x) => Number(x.requerido ?? 0) > 0,
          );
          const faltantes = aConsumir.filter(
            (x) => Number(x.faltante ?? 0) > 0,
          );
          if (faltantes.length) {
            throw new BadRequestException({
              message:
                'Stock insuficiente de insumos para confirmar el empaque',
              faltantes,
            });
          }

          for (const c of aConsumir) {
            const requerido = Number(c.requerido ?? 0);
            if (!Number.isFinite(requerido) || requerido <= 0) continue;

            const insumo = await insumoRepo.findOne({
              where: { id: c.insumoId, tenantId },
              lock: { mode: 'pessimistic_write' },
            });
            if (!insumo) throw new NotFoundException('Insumo no encontrado');

            const actualInsumo = Number(insumo.stockActual ?? 0);
            if (actualInsumo < requerido) {
              throw new BadRequestException(
                `Stock insuficiente de insumo "${insumo.nombre}" (actual ${actualInsumo}, requerido ${requerido})`,
              );
            }

            insumo.stockActual = actualInsumo - requerido;
            await insumoRepo.save(insumo);

            await insumoMovRepo.save(
              insumoMovRepo.create({
                tenantId,
                insumo,
                insumoId: insumo.id,
                tipo: TipoMovimientoInsumo.EGRESO,
                cantidad: -requerido,
                motivo: 'EMPAQUE_CONSUMO_INSUMO',
                referenciaId: empaque.id,
                responsableId: empaque.responsable?.id ?? null,
              }),
            );
          }

          continue;
        }

        // BULTO/UNIDAD => generar unidades con etiqueta
        const peso = dec(pres.pesoPorUnidadKg);
        if (!peso || peso <= 0) {
          throw new BadRequestException(
            `Presentación ${pres.codigo} requiere pesoPorUnidadKg`,
          );
        }

        // Regla: debe ser múltiplo exacto o permitimos redondeo?
        // Para producción robusta: exigimos exacto (evita inconsistencias).
        const unidadesExactas = kg / peso;
        const unidades = Math.round(unidadesExactas * 1000) / 1000;

        if (Math.abs(unidades - Math.round(unidades)) > 1e-9) {
          throw new BadRequestException(
            `La cantidadKg (${kg}) no es múltiplo exacto del pesoPorUnidadKg (${peso}) para ${pres.codigo}`,
          );
        }

        const unidadesInt = Math.round(unidades);

        stock.stockUnidades = dec(stock.stockUnidades) + unidadesInt;
        await stockPresRepo.save(stock);

        // Guardar en item la cantidad de unidades generadas
        it.cantidadUnidades = unidadesInt;
        await itemRepo.save(it);

        // Movimiento ingreso presentación
        await movRepo.save(
          movRepo.create({
            tenantId,
            tipo: TipoMovimiento.EMPAQUE_INGRESO_PRES,
            lotePF: empaque.lote,
            deposito: empaque.deposito,
            presentacion: pres,
            cantidadKg: kg,
            cantidadUnidades: unidadesInt,
            referenciaId: empaque.id,
          }),
        );

        // Generar unidades etiquetadas
        // Código: <codigoLote>-<presCodigo>-<secuencia>
        // Para secuencia usamos conteo actual + i (simple y seguro con unique por tenant+codigo).
        // Si querés secuencia global por presentación, lo ajustamos luego.
        const basePrefix = `${empaque.lote.codigoLote}-${pres.codigo}`;

        // obtener conteo actual para ese prefijo (evita colisiones)
        const result = await unidadRepo
          .createQueryBuilder('u')
          .select('COUNT(*)', 'cnt')
          .where('u.tenant_id = :tenantId', { tenantId })
          .andWhere('u.codigo_etiqueta LIKE :p', { p: `${basePrefix}-%` })
          .getRawOne<{ cnt: string }>();

        let seq = Number(result?.cnt ?? 0);

        const nuevas: PFUnidadEnvasada[] = [];
        for (let i = 0; i < unidadesInt; i++) {
          seq++;
          const codigoEtiqueta = `${basePrefix}-${String(seq).padStart(6, '0')}`;

          nuevas.push(
            unidadRepo.create({
              tenantId,
              loteOrigen: empaque.lote,
              presentacion: pres,
              deposito: empaque.deposito,
              codigoEtiqueta,
              pesoKg: peso,
              estado: 'DISPONIBLE',
            }),
          );
        }

        // insert masivo
        await unidadRepo.save(nuevas);

        // ============================
        // ✅ NUEVO: CONSUMO INSUMOS (UNIDAD/BULTO)
        // ============================
        const consumos = await this.insumoConsumoService.calcularConsumo(
          tenantId,
          {
            productoFinalId: productoFinalId ?? undefined,
            presentacionId: pres.id,
            unidades: unidadesInt,
            kg,
          },
        );

        const aConsumir = consumos.filter((x) => Number(x.requerido ?? 0) > 0);
        const faltantes = aConsumir.filter((x) => Number(x.faltante ?? 0) > 0);
        if (faltantes.length) {
          throw new BadRequestException({
            message: 'Stock insuficiente de insumos para confirmar el empaque',
            faltantes,
          });
        }

        for (const c of aConsumir) {
          const requerido = Number(c.requerido ?? 0);
          if (!Number.isFinite(requerido) || requerido <= 0) continue;

          const insumo = await insumoRepo.findOne({
            where: { id: c.insumoId, tenantId },
            lock: { mode: 'pessimistic_write' },
          });
          if (!insumo) throw new NotFoundException('Insumo no encontrado');

          const actualInsumo = Number(insumo.stockActual ?? 0);
          if (actualInsumo < requerido) {
            throw new BadRequestException(
              `Stock insuficiente de insumo "${insumo.nombre}" (actual ${actualInsumo}, requerido ${requerido})`,
            );
          }

          insumo.stockActual = actualInsumo - requerido;
          await insumoRepo.save(insumo);

          await insumoMovRepo.save(
            insumoMovRepo.create({
              tenantId,
              insumo,
              insumoId: insumo.id,
              tipo: TipoMovimientoInsumo.EGRESO,
              cantidad: -requerido,
              motivo: 'EMPAQUE_CONSUMO_INSUMO',
              referenciaId: empaque.id,
              responsableId: empaque.responsable?.id ?? null,
            }),
          );
        }
      }

      // 4) Confirmar empaque
      empaque.estado = 'CONFIRMADO';
      await empaqueRepo.save(empaque);

      await this.auditoria.registrar(
        tenantId,
        usuarioId,
        'EMPAQUE_CONFIRMADO',
        {
          empaqueId,
          lotePfId: empaque.lote.id,
          totalKg,
        },
      );

      // return detallado
      return empaqueRepo.findOne({
        where: { id: empaqueId, tenantId },
        relations: [
          'items',
          'items.presentacion',
          'lote',
          'deposito',
          'responsable',
        ],
      });
    });
  }

  async obtener(tenantId: string, id: string) {
    const e = await this.empaqueRepo.findOne({
      where: { id, tenantId },
      relations: [
        'items',
        'items.presentacion',
        'lote',
        'deposito',
        'responsable',
      ],
    });
    if (!e) throw new NotFoundException('Empaque no encontrado');
    return e;
  }

  async listar(tenantId: string, q: QueryEmpaquesDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    const offset = (page - 1) * limit;

    const mapOrder: Record<string, string> = {
      fecha: 'e.fecha',
      createdAt: 'e.created_at',
      estado: 'e.estado',
    };
    const orderCampo = mapOrder[q.ordenCampo ?? 'fecha'] ?? mapOrder.fecha;
    const orderDir = (q.ordenDireccion ?? 'DESC') as 'ASC' | 'DESC';

    // IDs paginados (evitar duplicados por join items)
    const idsQb = this.empaqueRepo
      .createQueryBuilder('e')
      .leftJoin('e.lote', 'l')
      .leftJoin('e.deposito', 'd')
      .leftJoin('e.responsable', 'r')
      .leftJoin('e.items', 'it')
      .leftJoin('it.presentacion', 'p')
      .where('e.tenant_id = :tenantId', { tenantId });

    if (q.estado) idsQb.andWhere('e.estado = :estado', { estado: q.estado });
    if (q.lotePfId)
      idsQb.andWhere('l.id = :lotePfId', { lotePfId: q.lotePfId });
    if (q.depositoId) idsQb.andWhere('d.id = :depId', { depId: q.depositoId });
    if (q.presentacionId)
      idsQb.andWhere('p.id = :presId', { presId: q.presentacionId });

    if (q.fechaDesde) idsQb.andWhere('e.fecha >= :fd', { fd: q.fechaDesde });
    if (q.fechaHasta) idsQb.andWhere('e.fecha <= :fh', { fh: q.fechaHasta });

    if (q.search) {
      const s = `%${q.search}%`;
      idsQb.andWhere(
        `(
        l.codigo_lote ILIKE :s
        OR p.codigo ILIKE :s
        OR p.nombre ILIKE :s
        OR e.observaciones ILIKE :s
      )`,
        { s },
      );
    }

    idsQb.select('e.id', 'id').distinctOn(['e.id']);
    idsQb
      .orderBy('e.id', 'ASC')
      .addOrderBy(orderCampo, orderDir)
      .addOrderBy('e.id', 'DESC');
    idsQb.offset(offset).limit(limit);

    const countQb = this.empaqueRepo
      .createQueryBuilder('e')
      .leftJoin('e.lote', 'l')
      .leftJoin('e.deposito', 'd')
      .leftJoin('e.items', 'it')
      .leftJoin('it.presentacion', 'p')
      .where('e.tenant_id = :tenantId', { tenantId });

    if (q.estado) countQb.andWhere('e.estado = :estado', { estado: q.estado });
    if (q.lotePfId)
      countQb.andWhere('l.id = :lotePfId', { lotePfId: q.lotePfId });
    if (q.depositoId)
      countQb.andWhere('d.id = :depId', { depId: q.depositoId });
    if (q.presentacionId)
      countQb.andWhere('p.id = :presId', { presId: q.presentacionId });
    if (q.fechaDesde) countQb.andWhere('e.fecha >= :fd', { fd: q.fechaDesde });
    if (q.fechaHasta) countQb.andWhere('e.fecha <= :fh', { fh: q.fechaHasta });
    if (q.search) {
      const s = `%${q.search}%`;
      countQb.andWhere(
        `(
        l.codigo_lote ILIKE :s
        OR p.codigo ILIKE :s
        OR p.nombre ILIKE :s
        OR e.observaciones ILIKE :s
      )`,
        { s },
      );
    }

    const totalRaw = await countQb
      .select('COUNT(DISTINCT e.id)', 'total')
      .getRawOne<{ total: string }>();
    const total = Number(totalRaw?.total ?? 0);

    const ids = (await idsQb.getRawMany<{ id: string }>()).map((x) => x.id);
    if (!ids.length) return { data: [], total, page, limit };

    const data = await this.empaqueRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.lote', 'l')
      .leftJoinAndSelect('e.deposito', 'd')
      .leftJoinAndSelect('e.responsable', 'r')
      .leftJoinAndSelect('e.items', 'it')
      .leftJoinAndSelect('it.presentacion', 'p')
      .where('e.tenant_id = :tenantId', { tenantId })
      .andWhere('e.id IN (:...ids)', { ids })
      .orderBy(orderCampo, orderDir)
      .addOrderBy('e.id', 'DESC')
      .getMany();

    return { data, total, page, limit };
  }

  async unidadesPorLote(tenantId: string, lotePfId: string) {
    return this.unidadRepo.find({
      where: { tenantId, loteOrigen: { id: lotePfId } as any },
      order: { createdAt: 'DESC' as any },
    });
  }

  async resumenStockPresentaciones(tenantId: string) {
    // Devuelve stock por presentación + depósito
    return this.stockPresRepo.find({
      where: { tenantId },
    });
  }

  async unidadesEnvasadasAgrupadas(
    tenantId: string,
    q: QueryUnidadesEnvasadasDto,
  ) {
    const unidadesLimit = q.unidadesLimit ?? 200; // default sano
    const unidadesOffset = q.unidadesOffset ?? 0;


    // ✅ NUEVO: flags
  const soloDisponibles = parseBool((q as any).soloDisponibles, false);
  const traerDetalle = parseBool((q as any).traerDetalle, true);

    // 1) GRUPOS + TOTALES
    const qb = this.unidadRepo
      .createQueryBuilder('u')
      .innerJoin('u.loteOrigen', 'l')
      .innerJoin('l.productoFinal', 'pf')
      .innerJoin('u.presentacion', 'p')
      .innerJoin('u.deposito', 'd')
      .where('u.tenant_id = :tenantId', { tenantId });

    if (q.loteId) qb.andWhere('l.id = :loteId', { loteId: q.loteId });
    if (q.presentacionId)
      qb.andWhere('p.id = :presentacionId', {
        presentacionId: q.presentacionId,
      });
    if (q.depositoId)
      qb.andWhere('d.id = :depositoId', { depositoId: q.depositoId });
    if (q.estado) qb.andWhere('u.estado = :estado', { estado: q.estado });

    // ✅ NUEVO: filtros por fecha de creación de unidad
if (q.fechaDesde) qb.andWhere('l.fecha_produccion >= :fd', { fd: q.fechaDesde });
if (q.fechaHasta) qb.andWhere('l.fecha_produccion <= :fh', { fh: q.fechaHasta });


    const gruposRaw = await qb
      .select([
        'l.id AS "loteId"',
        'l.codigo_lote AS "loteCodigo"',
        'l.fecha_vencimiento AS "loteFechaVencimiento"',
        'l.fecha_produccion AS "loteFechaProduccion"',
        'l.estado AS "loteEstado"',

        'pf.id AS "productoFinalId"',
        'pf.nombre AS "productoFinalNombre"',

        'p.id AS "presentacionId"',
        'p.codigo AS "presentacionCodigo"',
        'p.nombre AS "presentacionNombre"',

        'd.id AS "depositoId"',
        'd.nombre AS "depositoNombre"',

        'COUNT(*)::int AS "total"',
        `SUM(CASE WHEN u.estado = 'DISPONIBLE' THEN 1 ELSE 0 END)::int AS "disponibles"`,
        `SUM(CASE WHEN u.estado = 'ENTREGADO' THEN 1 ELSE 0 END)::int AS "entregadas"`,
        `SUM(CASE WHEN u.estado = 'ANULADO' THEN 1 ELSE 0 END)::int AS "anuladas"`,
        `SUM(CASE WHEN u.estado = 'MERMA' THEN 1 ELSE 0 END)::int AS "merma"`,
      ])
      .groupBy('l.id')
      .addGroupBy('l.codigo_lote')
      .addGroupBy('l.fecha_vencimiento')
      .addGroupBy('l.fecha_produccion')
      .addGroupBy('l.estado')
      .addGroupBy('pf.id')
      .addGroupBy('pf.nombre')
      .addGroupBy('p.id')
      .addGroupBy('p.codigo')
      .addGroupBy('p.nombre')
      .addGroupBy('d.id')
      .addGroupBy('d.nombre')
      // ✅ NUEVO: filtrar solo grupos con disponibles > 0
      .having(
        soloDisponibles
          ? `SUM(CASE WHEN u.estado = 'DISPONIBLE' THEN 1 ELSE 0 END) > 0`
          : '1=1',
      )
      .orderBy('l.fecha_vencimiento', 'ASC', 'NULLS LAST')
      .addOrderBy('l.fecha_produccion', 'ASC')
      .addOrderBy('l.codigo_lote', 'ASC')
      .getRawMany();

    if (!gruposRaw.length) return { data: [], unidadesLimit, unidadesOffset };

    // 2) Traer UNIDADES de los grupos encontrados (limit/offset global)
    //    Si querés limit por grupo, te lo armo, pero esto es excelente primera versión.
    const keys: GrupoKey[] = gruposRaw.map((g: any) => ({
      loteId: g.loteId,
      presentacionId: g.presentacionId,
      depositoId: g.depositoId,
    }));

    // Construimos ORs (Postgres) para traer solo esas combinaciones
    const unidadesQb = this.unidadRepo
      .createQueryBuilder('u')
      .innerJoin('u.loteOrigen', 'l')
      .innerJoin('u.presentacion', 'p')
      .innerJoin('u.deposito', 'd')
      .where('u.tenant_id = :tenantId', { tenantId });

    // Reaplicamos filtros (por si vino estado)
    if (q.estado)
      unidadesQb.andWhere('u.estado = :estado', { estado: q.estado });


    // ✅ NUEVO: reaplicamos rango de fechas al detalle
if (q.fechaDesde) unidadesQb.andWhere('l.fecha_produccion >= :fd', { fd: q.fechaDesde });
if (q.fechaHasta) unidadesQb.andWhere('l.fecha_produccion <= :fh', { fh: q.fechaHasta });


    // OR por combinaciones
    keys.forEach((k, idx) => {
      const cond = `(l.id = :l${idx} AND p.id = :p${idx} AND d.id = :d${idx})`;
      if (idx === 0) unidadesQb.andWhere(cond);
      else unidadesQb.orWhere(cond);

      unidadesQb.setParameter(`l${idx}`, k.loteId);
      unidadesQb.setParameter(`p${idx}`, k.presentacionId);
      unidadesQb.setParameter(`d${idx}`, k.depositoId);
    });

    const unidades = await unidadesQb
      .select([
        'u.id',
        'u.codigoEtiqueta',
        'u.estado',
        'u.pesoKg',
        'u.createdAt',

        'l.fechaVencimiento',
        'l.fechaProduccion',
        'l.id',
        'p.id',
        'd.id',
      ])
      .orderBy('l.fecha_vencimiento', 'ASC', 'NULLS LAST')
      .addOrderBy('l.fecha_produccion', 'ASC')
      .addOrderBy('u.createdAt', 'ASC')
      .offset(unidadesOffset)
      .limit(unidadesLimit)
      .getMany();

    // 3) Agrupar en memoria para armar el payload final
    const map = new Map<string, any>();

    for (const g of gruposRaw as any[]) {
      const k = keyOf({
        loteId: g.loteId,
        presentacionId: g.presentacionId,
        depositoId: g.depositoId,
      });

      map.set(k, {
        lote: {
          id: g.loteId,
          codigo: g.loteCodigo,
          fechaVencimiento: g.loteFechaVencimiento,
          fechaProduccion: g.loteFechaProduccion,
          estado: g.loteEstado,
        },
        presentacion: {
          id: g.presentacionId,
          codigo: g.presentacionCodigo,
          nombre: g.presentacionNombre,
        },
        deposito: {
          id: g.depositoId,
          nombre: g.depositoNombre,
        },
        productoFinal: {
          
          id: g.productoFinalId,
          nombre: g.productoFinalNombre,
        },
        totales: {
          total: Number(g.total ?? 0),
          disponibles: Number(g.disponibles ?? 0),
          entregadas: Number(g.entregadas ?? 0),
          anuladas: Number(g.anuladas ?? 0),
          merma: Number(g.merma ?? 0),
        },
        unidades: [] as Array<{
          id: string;
          codigoEtiqueta: string;
          estado: string;
          pesoKg: any;
          createdAt: any;
        }>,
      });
    }

    // ✅ NUEVO: si no quiere detalle, cortamos acá (no consultamos etiquetas)
  if (!traerDetalle) {
    return {
      data: Array.from(map.values()),
      unidadesLimit,
      unidadesOffset,
    };
  }

    for (const u of unidades as PFUnidadEnvasada[]) {
      const loteId = (u.loteOrigen as any)?.id;
      const presId = (u.presentacion as any)?.id;
      const depId = (u.deposito as any)?.id;
      const k = keyOf({ loteId, presentacionId: presId, depositoId: depId });

      const grp = map.get(k);
      if (!grp) continue;

      grp.unidades.push({
        id: u.id,
        codigoEtiqueta: u.codigoEtiqueta,
        estado: u.estado,
        pesoKg: u.pesoKg,
        createdAt: (u as any).createdAt,

        // ✅ NUEVO: vence igual que el lote origen
        fechaVencimiento: (u.loteOrigen as any)?.fechaVencimiento ?? null,
        // opcional:
        fechaProduccion: (u.loteOrigen as any)?.fechaProduccion ?? null,
      });
    }

    return {
      data: Array.from(map.values()),
      unidadesLimit,
      unidadesOffset,
    };
  }

  async descartarUnidadesPorLote(
    tenantId: string,
    usuarioId: string,
    dto: DescartarUnidadesLoteDto,
  ) {
    return this.ds.transaction(async (trx) => {
      const unidadRepo = trx.getRepository(PFUnidadEnvasada);
      const stockPresRepo = trx.getRepository(StockPresentacion);
      const loteRepo = trx.getRepository(LoteProductoFinal);
      const presRepo = trx.getRepository(PresentacionProductoFinal);
      const depRepo = trx.getRepository(Deposito);

      // Validaciones base (existencia)
      const lote = await loteRepo.findOne({
        where: { id: dto.loteId, tenantId },
      });
      if (!lote) throw new NotFoundException('Lote PF no encontrado');

      const pres = await presRepo.findOne({
        where: { id: dto.presentacionId, tenantId },
      });
      if (!pres) throw new NotFoundException('Presentación no encontrada');

      const dep = await depRepo.findOne({
        where: { id: dto.depositoId, tenantId },
      });
      if (!dep) throw new NotFoundException('Depósito no encontrado');

      // 1) Tomar N unidades DISPONIBLES del grupo (lote+pres+dep)
      //    (bloqueo pesimista para evitar carreras)
      const unidades = await unidadRepo
        .createQueryBuilder('u')
        .innerJoin('u.loteOrigen', 'l')
        .innerJoin('u.presentacion', 'p')
        .innerJoin('u.deposito', 'd')
        .where('u.tenant_id = :tenantId', { tenantId })
        .andWhere('l.id = :loteId', { loteId: dto.loteId })
        .andWhere('p.id = :presId', { presId: dto.presentacionId })
        .andWhere('d.id = :depId', { depId: dto.depositoId })
        .andWhere('u.estado = :estado', { estado: 'DISPONIBLE' })
        .orderBy('u.created_at', 'ASC')
        .limit(dto.cantidad)
        .setLock('pessimistic_write')
        .getMany();

      if (unidades.length === 0) {
        throw new BadRequestException(
          'No hay unidades DISPONIBLES para descartar en ese grupo',
        );
      }

      if (unidades.length < dto.cantidad) {
        throw new BadRequestException(
          `Solo hay ${unidades.length} unidades DISPONIBLES (pediste ${dto.cantidad})`,
        );
      }

      const ids = unidades.map((u) => u.id);

      // 2) Update masivo de estado
      await unidadRepo.update(
        { tenantId, id: In(ids) as any },
        { estado: dto.estadoDestino as any },
      );

      // 3) Ajustar stock_presentaciones (UNIDADES y opcional kg)
      //    * Acá asumimos que estas unidades cuentan en stockUnidades.
      let stock = await stockPresRepo.findOne({
        where: {
          tenantId,
          presentacion: { id: pres.id } as any,
          deposito: { id: dep.id } as any,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!stock) {
        // si no existe, lo creamos en 0 y ajustamos (queda negativo si algo está muy mal)
        stock = stockPresRepo.create({
          tenantId,
          presentacion: pres,
          deposito: dep,
          stockKg: 0,
          stockUnidades: 0,
        });
      }

      const totalUnidades = unidades.length;
      const totalKg = unidades.reduce(
        (acc, u) => acc + Number(u.pesoKg ?? 0),
        0,
      );

      const nuevoUnidades = Number(stock.stockUnidades ?? 0) - totalUnidades;
      if (nuevoUnidades < 0) {
        throw new BadRequestException(
          `El ajuste dejaría stockUnidades negativo (actual ${stock.stockUnidades}, descartar ${totalUnidades})`,
        );
      }

      stock.stockUnidades = nuevoUnidades;

      // opcional: si querés también reflejar kg (depende de cómo lo uses en tu UI)
      // stock.stockKg = Number(stock.stockKg ?? 0) - totalKg;

      await stockPresRepo.save(stock);

      const movRepo = trx.getRepository(StockMovimiento);
      // 3.5) ✅ NUEVO: registrar movimiento de stock (MERMA_PFE)
      // - cantidadKg y cantidadUnidades NEGATIVAS
      // - referenciaId: id "lógico" de la operación (podés usar loteId/presentacionId o generar un uuid)
      // - evidencia: metadata útil para auditoría
      await movRepo.save(
        movRepo.create({
          tenantId,
          tipo: TipoMovimiento.MERMA_PFE,
          lotePF: lote,
          deposito: dep,
          presentacion: pres,
          cantidadKg: -Number(totalKg ?? 0),
          cantidadUnidades: -Number(totalUnidades ?? 0),
          referenciaId: 'MERMA_PFE',
          motivo: dto.motivo ?? `DESCARTE_UNIDADES -> ${dto.estadoDestino}`,
          responsableId: usuarioId,
          evidencia: {
            estadoDestino: dto.estadoDestino,
            cantidad: totalUnidades,
            unidadIds: ids,
            depositoId: dep.id,
            presentacionId: pres.id,
            loteId: lote.id,
          },
        }),
      );

      // 4) Auditoría
      await this.auditoria.registrar(
        tenantId,
        usuarioId,
        'UNIDADES_DESCARTADAS',
        {
          loteId: lote.id,
          presentacionId: pres.id,
          depositoId: dep.id,
          cantidad: totalUnidades,
          totalKg,
          estadoDestino: dto.estadoDestino,
          motivo: dto.motivo ?? null,
          unidadIds: ids,
        },
      );

      return {
        ok: true,
        loteId: lote.id,
        presentacionId: pres.id,
        depositoId: dep.id,
        estadoDestino: dto.estadoDestino,
        descartadas: totalUnidades,
        totalKg: Number(totalKg.toFixed(6)),
        unidadIds: ids,
      };
    });
  }
}
