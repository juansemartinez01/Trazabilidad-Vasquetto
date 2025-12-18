import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, In, Repository } from 'typeorm';
import { Proveedor } from './entities/proveedor.entity';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { FiltroProveedoresDto } from './dto/filtro-proveedores.dto';
import { ProveedorMateriaPrima } from './entities/proveedor-materia-prima.entity';
import { MateriaPrima } from '../materia-prima/entities/materia-prima.entity';

@Injectable()
export class ProveedoresService {
  constructor(
    @InjectRepository(Proveedor)
    private repo: Repository<Proveedor>,
    @InjectRepository(ProveedorMateriaPrima)
    private linkRepo: Repository<ProveedorMateriaPrima>,
    @InjectRepository(MateriaPrima) private mpRepo: Repository<MateriaPrima>,
  ) {}

  private normalizeCuit(cuit?: string) {
    if (!cuit) return undefined;
    return cuit.replace(/[^\d]/g, ''); // deja solo números
  }

  async crear(tenantId: string, dto: CreateProveedorDto) {
    const cuitNorm = this.normalizeCuit(dto.cuit);

    if (cuitNorm) {
      const existente = await this.repo.findOne({
        where: { tenantId, cuit: cuitNorm as any }, // la columna guarda normalizado
      });

      if (existente) {
        const extra = existente.activo ? '' : ' (está inactivo)';
        throw new BadRequestException(
          `Ya existe un proveedor con ese CUIT y es: ${existente.razonSocial}${extra}`,
        );
      }
    }

    const entity: DeepPartial<Proveedor> = {
      tenantId,
      razonSocial: dto.razonSocial,
      cuit: cuitNorm, // <-- no null, ver error 3
      numeroRenspa: dto.numeroRenspa,
      numeroInscripcionSenasa: dto.numeroInscripcionSenasa,
      direccion: dto.direccion,
      localidad: dto.localidad,
      provincia: dto.provincia,
      contacto: dto.contacto,
      telefono: dto.telefono,
      email: dto.email,
      activo: true,
    };

    const saved = await this.repo.save(entity);

    if (dto.materiaPrimaIds?.length) {
      await this.setMateriasPrimas(tenantId, saved.id, dto.materiaPrimaIds);
    }

    return this.obtenerUno(tenantId, saved.id);
  }

  async actualizar(tenantId: string, id: string, dto: UpdateProveedorDto) {
    const proveedor = await this.repo.findOne({ where: { id, tenantId } });
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado');

    const cuitNorm = this.normalizeCuit(dto.cuit);

    if (dto.cuit !== undefined) {
      if (cuitNorm) {
        const existente = await this.repo.findOne({
          where: { tenantId, cuit: cuitNorm as any },
        });

        if (existente && existente.id !== id) {
          const extra = existente.activo ? '' : ' (está inactivo)';
          throw new BadRequestException(
            `Ya existe un proveedor con ese CUIT y es: ${existente.razonSocial}${extra}`,
          );
        }
      }

      proveedor.cuit = cuitNorm ?? null;
    }

    if (dto.razonSocial !== undefined) proveedor.razonSocial = dto.razonSocial;
    if (dto.numeroRenspa !== undefined)
      proveedor.numeroRenspa = dto.numeroRenspa ?? null;
    if (dto.numeroInscripcionSenasa !== undefined)
      proveedor.numeroInscripcionSenasa = dto.numeroInscripcionSenasa ?? null;

    if (dto.direccion !== undefined)
      proveedor.direccion = dto.direccion ?? null;
    if (dto.localidad !== undefined)
      proveedor.localidad = dto.localidad ?? null;
    if (dto.provincia !== undefined)
      proveedor.provincia = dto.provincia ?? null;
    if (dto.contacto !== undefined) proveedor.contacto = dto.contacto ?? null;
    if (dto.telefono !== undefined) proveedor.telefono = dto.telefono ?? null;
    if (dto.email !== undefined) proveedor.email = dto.email ?? null;

    await this.repo.save(proveedor);

    if (dto.materiaPrimaIds) {
      await this.setMateriasPrimas(tenantId, id, dto.materiaPrimaIds);
    }

    return this.obtenerUno(tenantId, id);
  }

  async setMateriasPrimas(
    tenantId: string,
    proveedorId: string,
    mpIds: string[],
  ) {
    // validación: que existan y sean del tenant
    const materias = await this.mpRepo.find({
      where: { tenantId, id: In(mpIds) },
    });

    if (materias.length !== mpIds.length) {
      throw new BadRequestException(
        'Alguna materia prima no existe o no pertenece al tenant',
      );
    }

    // hard replace (simple y consistente)
    await this.linkRepo.delete({
      tenantId,
      proveedor: { id: proveedorId } as any,
    });

    const proveedorRef = { id: proveedorId } as any;

    const links = materias.map((mp) =>
      this.linkRepo.create({
        tenantId,
        proveedor: proveedorRef,
        materiaPrima: mp,
      }),
    );

    await this.linkRepo.save(links);
  }

  async eliminar(tenantId: string, id: string) {
    const proveedor = await this.repo.findOne({ where: { id, tenantId } });
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado');

    proveedor.activo = false;
    return this.repo.save(proveedor);
  }

  async obtenerUno(tenantId: string, id: string) {
    const proveedor = await this.repo.findOne({
      where: { id, tenantId, activo: true },
      relations: ['materiasPrimasLink', 'materiasPrimasLink.materiaPrima'],
    });
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado');

    return proveedor;
  }

  async buscar(tenantId: string, dto: FiltroProveedoresDto) {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 15;
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.activo = true');

    if (dto.search) {
      qb.andWhere(
        `
        (p.razonSocial ILIKE :s OR 
         p.cuit ILIKE :s OR 
         p.localidad ILIKE :s)
      `,
        { s: `%${dto.search}%` },
      );
    }

    if (dto.cuit) qb.andWhere('p.cuit = :cuit', { cuit: dto.cuit });

    if (dto.localidad)
      qb.andWhere('p.localidad ILIKE :loc', { loc: `%${dto.localidad}%` });

    qb.orderBy('p.razonSocial', 'ASC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }
}
