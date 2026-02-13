// src/modules/insumos/insumo-consumo-pf.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { InsumoConsumoPF } from './entities/insumo-consumo-pf.entity';
import { Insumo } from './entities/insumo.entity';
import { ProductoFinal } from '../producto-final/entities/producto-final.entity';
import { PresentacionProductoFinal } from '../producto-final/entities/presentacion-producto-final.entity';
import { CreateInsumoConsumoPfDto } from './dto/create-insumo-consumo-pf.dto';
import { UpdateInsumoConsumoPfDto } from './dto/update-insumo-consumo-pf.dto';
import { CalcularConsumoInsumosDto } from './dto/calcular-consumo-insumos.dto';
import { QueryInsumoConsumoPfDto } from './dto/query-insumo-consumo-pf.dto';

@Injectable()
export class InsumoConsumoPfService {
  constructor(
    @InjectRepository(InsumoConsumoPF)
    private repo: Repository<InsumoConsumoPF>,
    @InjectRepository(Insumo) private insumoRepo: Repository<Insumo>,
    @InjectRepository(ProductoFinal) private pfRepo: Repository<ProductoFinal>,
    @InjectRepository(PresentacionProductoFinal)
    private presRepo: Repository<PresentacionProductoFinal>,
  ) {}

  async crear(tenantId: string, dto: CreateInsumoConsumoPfDto) {
    if (!dto.productoFinalId && !dto.presentacionId) {
      throw new BadRequestException(
        'Debe venir productoFinalId o presentacionId',
      );
    }

    const insumo = await this.insumoRepo.findOne({
      where: { id: dto.insumoId, tenantId },
    });
    if (!insumo) throw new NotFoundException('Insumo no encontrado');

    let productoFinalId: string | null = dto.productoFinalId ?? null;
    let presentacionId: string | null = dto.presentacionId ?? null;

    if (productoFinalId) {
      const pf = await this.pfRepo.findOne({
        where: { id: productoFinalId, tenantId },
      });
      if (!pf) throw new NotFoundException('Producto final no encontrado');
    }

    if (presentacionId) {
      const pres = await this.presRepo.findOne({
        where: { id: presentacionId, tenantId },
        relations: ['productoFinal'],
      });
      if (!pres) throw new NotFoundException('Presentación no encontrada');
      if (!productoFinalId) productoFinalId = pres.productoFinal?.id ?? null;
    }

    const quiereSerEnvase = Boolean(dto.esEnvase);

    // ✅ si va a ser envase por presentación => validar 1 envase por presentacion
    if (presentacionId && quiereSerEnvase) {
      const existente = await this.repo.findOne({
        where: { tenantId, presentacionId, activo: true, esEnvase: true },
      });
      if (existente) {
        throw new BadRequestException(
          `La presentación ya tiene un envase asociado (regla ${existente.id}).`,
        );
      }
    }

    // ✅ si es envase => marcar también al insumo
    if (quiereSerEnvase && !(insumo as any).esEnvase) {
      (insumo as any).esEnvase = true;
      await this.insumoRepo.save(insumo);
    }

    const row = this.repo.create({
      tenantId,
      insumoId: insumo.id,
      productoFinalId,
      presentacionId,
      cantidadPorUnidad: dto.cantidadPorUnidad ?? null,
      cantidadPorKg: dto.cantidadPorKg ?? null,
      activo: dto.activo ?? true,
      esEnvase: quiereSerEnvase,
    });

    try {
      return await this.repo.save(row);
    } catch (e: any) {
      throw new BadRequestException(
        `No se pudo crear regla (posible duplicado): ${e?.message ?? e}`,
      );
    }
  }

  listar(
    tenantId: string,
    filtro?: { productoFinalId?: string; presentacionId?: string },
  ) {
    const qb = this.repo
      .createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId });

    if (filtro?.productoFinalId) {
      qb.andWhere('r.producto_final_id = :pf', { pf: filtro.productoFinalId });
    }
    if (filtro?.presentacionId) {
      qb.andWhere('r.presentacion_id = :pres', { pres: filtro.presentacionId });
    }

    return qb.orderBy('r.created_at', 'DESC').getMany();
  }

  async getOne(tenantId: string, id: string) {
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Regla no encontrada');
    return row;
  }

  async update(tenantId: string, id: string, dto: UpdateInsumoConsumoPfDto) {
    const actual = await this.getOne(tenantId, id);

    // si quisieras impedir cambiar target/insumo, lo bloqueamos;
    // pero te lo dejo habilitado con validaciones por si lo necesitás.
    const nextProductoFinalId =
      dto.productoFinalId !== undefined
        ? dto.productoFinalId
        : actual.productoFinalId;
    const nextPresentacionId =
      dto.presentacionId !== undefined
        ? dto.presentacionId
        : actual.presentacionId;

    if (!nextProductoFinalId && !nextPresentacionId) {
      throw new BadRequestException(
        'Debe existir productoFinalId o presentacionId',
      );
    }

    if (actual.presentacionId && actual.esEnvase) {
      const existente = await this.repo
        .createQueryBuilder('r')
        .where('r.tenant_id = :tenantId', { tenantId })
        .andWhere('r.activo = true')
        .andWhere('r.es_envase = true')
        .andWhere('r.presentacion_id = :pres', { pres: actual.presentacionId })
        .andWhere('r.id <> :id', { id: actual.id })
        .getOne();

      if (existente) {
        throw new BadRequestException(
          `La presentación ya tiene un envase asociado (regla ${existente.id}).`,
        );
      }
    }

    let nextInsumo = actual.insumo; // por si ya viene eager
    let nextInsumoId = actual.insumoId;

    if (dto.insumoId !== undefined) {
      const insumo = await this.insumoRepo.findOne({
        where: { id: dto.insumoId, tenantId },
      });
      if (!insumo) throw new NotFoundException('Insumo no encontrado');

      nextInsumo = insumo;
      nextInsumoId = insumo.id;
      actual.insumoId = insumo.id;
    }

    // recalcular flag
    const nextEsEnvase = Boolean((nextInsumo as any)?.esEnvase);
    actual.esEnvase = nextEsEnvase;

    if (nextProductoFinalId) {
      const pf = await this.pfRepo.findOne({
        where: { id: nextProductoFinalId, tenantId },
      });
      if (!pf) throw new NotFoundException('Producto final no encontrado');
    }

    if (nextPresentacionId) {
      const pres = await this.presRepo.findOne({
        where: { id: nextPresentacionId, tenantId },
      });
      if (!pres) throw new NotFoundException('Presentación no encontrada');
    }

    actual.productoFinalId = nextProductoFinalId ?? null;
    actual.presentacionId = nextPresentacionId ?? null;

    if (dto.cantidadPorUnidad !== undefined)
      actual.cantidadPorUnidad = dto.cantidadPorUnidad ?? null;
    if (dto.cantidadPorKg !== undefined)
      actual.cantidadPorKg = dto.cantidadPorKg ?? null;
    if (dto.activo !== undefined) actual.activo = dto.activo;

    try {
      return await this.repo.save(actual);
    } catch (e: any) {
      throw new BadRequestException(
        `No se pudo actualizar (posible duplicado): ${e?.message ?? e}`,
      );
    }
  }

  async delete(tenantId: string, id: string) {
    await this.getOne(tenantId, id);
    const res = await this.repo.delete({ id, tenantId });
    if (!res.affected) throw new NotFoundException('Regla no encontrada');
    return { message: 'Regla eliminada' };
  }

  /**
   * ✅ Resolver reglas aplicables (prioridad: presentacion > productoFinal)
   * - Si viene presentacionId, toma reglas de esa presentación + reglas genéricas del PF
   *   pero si un insumo está en ambos, gana la de presentacion.
   */
  async resolverReglas(
    tenantId: string,
    input: { productoFinalId?: string; presentacionId?: string },
  ) {
    if (!input.productoFinalId && !input.presentacionId) {
      throw new BadRequestException(
        'Debe venir productoFinalId o presentacionId',
      );
    }

    let productoFinalId = input.productoFinalId ?? null;

    if (input.presentacionId) {
      const pres = await this.presRepo.findOne({
        where: { id: input.presentacionId, tenantId },
        relations: ['productoFinal'],
      });
      if (!pres) throw new NotFoundException('Presentación no encontrada');
      if (!productoFinalId) productoFinalId = pres.productoFinal?.id ?? null;
    }

    // Traemos ambas capas
    const rows = await this.repo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.insumo', 'i') // ✅ clave
      .leftJoinAndSelect('r.productoFinal', 'pf') // opcional
      .leftJoinAndSelect('r.presentacion', 'pres') // opcional
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.activo = true')
      .andWhere(
        new Brackets((qb) => {
          if (input.presentacionId) {
            qb.orWhere('r.presentacion_id = :pres', {
              pres: input.presentacionId,
            });
          }
          if (productoFinalId) {
            qb.orWhere(
              '(r.presentacion_id IS NULL AND r.producto_final_id = :pf)',
              { pf: productoFinalId },
            );
          }
        }),
      )
      .getMany();

    // Prioridad: si hay presentacion, pisa por insumoId
    const map = new Map<string, InsumoConsumoPF>();

    // primero cargamos las genéricas (PF)
    for (const r of rows.filter((x) => !x.presentacionId)) {
      map.set(r.insumoId, r);
    }
    // después las específicas (Presentación)
    for (const r of rows.filter((x) => !!x.presentacionId)) {
      map.set(r.insumoId, r);
    }

    return Array.from(map.values());
  }

  /**
   * ✅ Calcular consumo: devuelve requerido + stockActual + faltante por insumo
   */
  async calcularConsumo(tenantId: string, dto: CalcularConsumoInsumosDto) {
    const reglas = await this.resolverReglas(tenantId, {
      productoFinalId: dto.productoFinalId,
      presentacionId: dto.presentacionId,
    });

    const unidades = Number(dto.unidades ?? 0);
    const kg = Number(dto.kg ?? 0);

    // Traemos stock actual de cada insumo (ya lo trae eager en regla, pero por seguridad)
    return reglas
      .map((r) => {
        const stockActual = Number(r.insumo?.stockActual ?? 0);

        const porUnidad = Number(r.cantidadPorUnidad ?? 0);
        const porKg = Number(r.cantidadPorKg ?? 0);

        const requerido = porUnidad * unidades + porKg * kg;

        return {
          insumoId: r.insumoId,
          nombre: r.insumo?.nombre,
          unidad: r.insumo?.unidad,

          regla: {
            id: r.id,
            productoFinalId: r.productoFinalId,
            presentacionId: r.presentacionId,
            cantidadPorUnidad: porUnidad || null,
            cantidadPorKg: porKg || null,
          },

          stockActual,
          requerido: Number(requerido.toFixed(6)),
          faltante: Math.max(0, Number((requerido - stockActual).toFixed(6))),
        };
      })
      .sort((a, b) => b.faltante - a.faltante);
  }

  async listarPaginado(tenantId: string, query: QueryInsumoConsumoPfDto) {
    const page = Number(query.page ?? 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit ?? 50)));
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('r')
      .leftJoin('r.insumo', 'i')
      .leftJoin('r.productoFinal', 'pf')
      .leftJoin('r.presentacion', 'pres')
      .where('r.tenantId = :tenantId', { tenantId });

    // filtros exactos
    if (query.productoFinalId)
      qb.andWhere('r.productoFinalId = :pfId', { pfId: query.productoFinalId });
    if (query.presentacionId)
      qb.andWhere('r.presentacionId = :presId', {
        presId: query.presentacionId,
      });
    if (query.insumoId)
      qb.andWhere('r.insumoId = :insId', { insId: query.insumoId });

    // flags
    if (query.activo !== undefined)
      qb.andWhere('r.activo = :activo', { activo: query.activo });
    if (query.esEnvase !== undefined)
      qb.andWhere('r.esEnvase = :esEnvase', { esEnvase: query.esEnvase });

    // búsqueda
    const q = query.q?.trim();
    if (q) {
      qb.andWhere(
        `(i.nombre ILIKE :q OR pf.nombre ILIKE :q OR pres.nombre ILIKE :q)`,
        { q: `%${q}%` },
      );
    }

    // select liviano (evita hidratar entidades completas)
    qb.select([
      'r.id',
      'r.createdAt',
      'r.insumoId',
      'r.productoFinalId',
      'r.presentacionId',
      'r.cantidadPorUnidad',
      'r.cantidadPorKg',
      'r.activo',
      'r.esEnvase',

      'i.id',
      'i.nombre',
      'i.unidad',
      'i.esEnvase',

      'pf.id',
      'pf.nombre',

      'pres.id',
      'pres.nombre',
    ]);

    const order = (query.order ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy('r.createdAt', order);

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      items,
    };
  }

  async listarPaginadoSinReglas(
    tenantId: string,
    query: QueryInsumoConsumoPfDto,
  ) {
    const page = Number(query.page ?? 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit ?? 50)));
    const skip = (page - 1) * limit;

    // Traigo presentaciones del tenant que NO tienen ninguna regla en insumo_consumo_pf
    const qb = this.presRepo
      .createQueryBuilder('pres')
      .innerJoin('pres.productoFinal', 'pf')
      .where('pres.tenant_id = :tenantId', { tenantId })
      .andWhere(
        `NOT EXISTS (
        SELECT 1
        FROM insumo_consumo_pf r
        WHERE r.tenant_id = :tenantId
          AND r.presentacion_id = pres.id
      )`,
        { tenantId },
      );

    // filtros aplicables
    if (query.presentacionId)
      qb.andWhere('pres.id = :presId', { presId: query.presentacionId });
    if (query.productoFinalId)
      qb.andWhere('pf.id = :pfId', { pfId: query.productoFinalId });

    const q = query.q?.trim();
    if (q) {
      qb.andWhere(
        new Brackets((b) => {
          b.where('pres.nombre ILIKE :q', { q: `%${q}%` }).orWhere(
            'pf.nombre ILIKE :q',
            { q: `%${q}%` },
          );
        }),
      );
    }

    // select “plano” (raw) para controlar salida exacta
    qb.select([
      'pres.id as pres_id',
      'pres.created_at as pres_created_at',
      'pres.nombre as pres_nombre',
      'pf.id as pf_id',
      'pf.nombre as pf_nombre',
    ]);

    const order = (query.order ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy('pres.created_at', order);

    const [rawItems, total] = (await qb.offset(skip).limit(limit)
      .getManyAndCount)
      ? await (async () => {
          const items = await qb.getRawMany<{
            pres_id: string;
            pres_created_at: string;
            pres_nombre: string;
            pf_id: string;
            pf_nombre: string;
          }>();

          // para el total, clono query sin paginado y hago COUNT(*)
          const total = await this.presRepo
            .createQueryBuilder('pres')
            .innerJoin('pres.productoFinal', 'pf')
            .where('pres.tenant_id = :tenantId', { tenantId })
            .andWhere(
              `NOT EXISTS (
              SELECT 1 FROM insumo_consumo_pf r
              WHERE r.tenant_id = :tenantId AND r.presentacion_id = pres.id
            )`,
              { tenantId },
            )
            .andWhere(query.presentacionId ? 'pres.id = :presId' : '1=1', {
              presId: query.presentacionId,
            })
            .andWhere(query.productoFinalId ? 'pf.id = :pfId' : '1=1', {
              pfId: query.productoFinalId,
            })
            .andWhere(
              q ? `(pres.nombre ILIKE :q OR pf.nombre ILIKE :q)` : '1=1',
              q ? { q: `%${q}%` } : {},
            )
            .getCount();

          return [items, total] as const;
        })()
      : ([[], 0] as const);

    // ✅ Mapear a “Regla virtual” con el shape exacto
    const items = rawItems.map((r) => ({
      id: r.pres_id, // 👈 importante: usamos el id de la presentación
      createdAt: r.pres_created_at, // 👈 createdAt de la presentación

      insumo: null,
      insumoId: null,

      productoFinal: {
        id: r.pf_id,
        nombre: r.pf_nombre,
      },
      productoFinalId: r.pf_id,

      presentacion: {
        id: r.pres_id,
        nombre: r.pres_nombre,
      },
      presentacionId: r.pres_id,

      cantidadPorUnidad: null,
      cantidadPorKg: null,

      activo: true, // o pres.activa si querés, pero entonces hay que traerla
      esEnvase: false,
    }));

    return {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      items,
    };
  }
}
