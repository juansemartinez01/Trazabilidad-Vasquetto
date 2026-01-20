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

    // Validar PF / Presentación si vienen
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

      // Si no te mandan productoFinalId, lo inferimos (opcional pero útil)
      if (!productoFinalId) productoFinalId = pres.productoFinal?.id ?? null;
    }

    const row = this.repo.create({
      tenantId,
      insumoId: insumo.id,
      productoFinalId,
      presentacionId,
      cantidadPorUnidad: dto.cantidadPorUnidad ?? null,
      cantidadPorKg: dto.cantidadPorKg ?? null,
      activo: dto.activo ?? true,
    });

    try {
      return await this.repo.save(row);
    } catch (e: any) {
      // típicos: violación unique parcial
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

    if (dto.insumoId !== undefined) {
      const insumo = await this.insumoRepo.findOne({
        where: { id: dto.insumoId, tenantId },
      });
      if (!insumo) throw new NotFoundException('Insumo no encontrado');
      actual.insumoId = insumo.id;
    }

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
}
