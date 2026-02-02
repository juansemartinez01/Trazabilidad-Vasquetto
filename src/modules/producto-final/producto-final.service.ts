// src/modules/producto-final/producto-final.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductoFinal } from './entities/producto-final.entity';
import {
  PresentacionProductoFinal,
  UnidadVenta,
} from './entities/presentacion-producto-final.entity';
import { CreateProductoFinalDto } from './dto/create-producto-final.dto';
import { UpdateProductoFinalDto } from './dto/update-producto-final.dto';

@Injectable()
export class ProductoFinalService {
  constructor(
    @InjectRepository(ProductoFinal) private pfRepo: Repository<ProductoFinal>,
    @InjectRepository(PresentacionProductoFinal)
    private presRepo: Repository<PresentacionProductoFinal>,
  ) {}

  async crear(tenantId: string, dto: CreateProductoFinalDto) {
    const pf = this.pfRepo.create({
      tenantId,
      nombre: dto.nombre,
      codigo: dto.codigo,
      descripcion: dto.descripcion ?? null,
      activo: dto.activo ?? true,
      vidaUtilDias: dto.vidaUtilDias ?? null,
      especificaciones: dto.especificaciones ?? null,
      presentaciones: [],
    });

    if (dto.presentaciones?.length) {
      pf.presentaciones = dto.presentaciones.map((p) => {
        // regla: si unidadVenta != KG, debe tener pesoPorUnidadKg
        const unidad = p.unidadVenta;
        const peso = p.pesoPorUnidadKg ?? null;

        if (unidad !== UnidadVenta.KG && (!peso || Number(peso) <= 0)) {
          throw new BadRequestException(
            `La presentación ${p.codigo} requiere pesoPorUnidadKg si unidadVenta es ${unidad}`,
          );
        }

        return this.presRepo.create({
          tenantId, // ✅ multi-tenant fijo
          codigo: p.codigo,
          nombre: p.nombre,
          unidadVenta: unidad,
          pesoPorUnidadKg: peso,
          activa: p.activa ?? true,
        });
      });
    }

    const saved = await this.pfRepo.save(pf);
    return this.obtener(tenantId, saved.id);
  }

  listar(tenantId: string) {
    return this.pfRepo.find({
      where: { tenantId },
      relations: ['presentaciones'],
      order: { nombre: 'ASC' },
    });
  }

  async obtener(tenantId: string, id: string) {
    const pf = await this.pfRepo.findOne({
      where: { id, tenantId },
      relations: ['presentaciones'],
    });
    if (!pf) throw new NotFoundException('Producto final no encontrado');
    return pf;
  }

  async actualizar(tenantId: string, id: string, dto: UpdateProductoFinalDto) {
    const pf = await this.obtener(tenantId, id);

    pf.nombre = dto.nombre ?? pf.nombre;
    pf.codigo = dto.codigo ?? pf.codigo;
    pf.descripcion = dto.descripcion ?? pf.descripcion;
    pf.activo = dto.activo ?? pf.activo;
    pf.vidaUtilDias = dto.vidaUtilDias ?? pf.vidaUtilDias;
    pf.especificaciones = dto.especificaciones ?? pf.especificaciones;

    if (dto.presentaciones) {
      // 1) Traemos presentaciones actuales del PF
      const actuales = await this.presRepo.find({
        where: { tenantId, productoFinal: { id: pf.id } as any },
      });

      const actualesPorCodigo = new Map(actuales.map((p) => [p.codigo, p]));
      const incomingCodigos = new Set(dto.presentaciones.map((p) => p.codigo));

      const nuevas: PresentacionProductoFinal[] = [];

      // 2) Upsert por "codigo" (es único por tenant según tu index)
      for (const p of dto.presentaciones) {
        const unidad = p.unidadVenta;
        const peso = p.pesoPorUnidadKg ?? null;

        if (unidad !== UnidadVenta.KG && (!peso || Number(peso) <= 0)) {
          throw new BadRequestException(
            `La presentación ${p.codigo} requiere pesoPorUnidadKg si unidadVenta es ${unidad}`,
          );
        }

        const existente = actualesPorCodigo.get(p.codigo);

        if (existente) {
          // update in-place (NO rompe FK)
          existente.nombre = p.nombre ?? existente.nombre;
          existente.unidadVenta = unidad ?? existente.unidadVenta;
          existente.pesoPorUnidadKg = peso;
          existente.activa = p.activa ?? true;
        } else {
          // create new
          nuevas.push(
            this.presRepo.create({
              tenantId,
              productoFinal: pf,
              codigo: p.codigo,
              nombre: p.nombre,
              unidadVenta: unidad,
              pesoPorUnidadKg: peso,
              activa: p.activa ?? true,
            }),
          );
        }
      }

      // 3) Las que ya no vienen en el request => desactivar (NO borrar)
      for (const a of actuales) {
        if (!incomingCodigos.has(a.codigo)) {
          a.activa = false;
        }
      }

      // 4) Guardamos updates + inserts
      await this.presRepo.save([...actuales, ...nuevas]);

      // 5) Refrescamos relación en memoria (opcional)
      pf.presentaciones = await this.presRepo.find({
        where: { tenantId, productoFinal: { id: pf.id } as any },
        order: { codigo: 'ASC' as any },
      });
    }


    await this.pfRepo.save(pf);
    return this.obtener(tenantId, id);
  }

  async eliminar(tenantId: string, id: string) {
    const pf = await this.obtener(tenantId, id);
    pf.activo = false;
    await this.pfRepo.save(pf);
    return { ok: true };
  }
}
