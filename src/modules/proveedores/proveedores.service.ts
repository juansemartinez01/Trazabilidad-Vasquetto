import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Proveedor } from './entities/proveedor.entity';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { FiltroProveedoresDto } from './dto/filtro-proveedores.dto';

@Injectable()
export class ProveedoresService {
  constructor(
    @InjectRepository(Proveedor)
    private repo: Repository<Proveedor>,
  ) {}

  async crear(tenantId: string, dto: CreateProveedorDto) {
    const entity = this.repo.create({
      ...dto,
      tenantId,
      activo: true,
    });
    return await this.repo.save(entity);
  }

  async actualizar(tenantId: string, id: string, dto: UpdateProveedorDto) {
    const proveedor = await this.repo.findOne({ where: { id, tenantId } });
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado');

    Object.assign(proveedor, dto);
    return await this.repo.save(proveedor);
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
