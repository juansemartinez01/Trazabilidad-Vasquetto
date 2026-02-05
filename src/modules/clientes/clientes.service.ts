import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Cliente } from './entities/cliente.entity';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { FiltroClientesDto } from './dto/filtro-clientes.dto';

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Cliente)
    private repo: Repository<Cliente>,
  ) {}

  async crear(tenantId: string, dto: CreateClienteDto) {
    const entity = this.repo.create({
      ...dto,
      tenantId,
      activo: true,
    });

    return await this.repo.save(entity);
  }

  async actualizar(tenantId: string, id: string, dto: UpdateClienteDto) {
    const cliente = await this.repo.findOne({ where: { id, tenantId } });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');

    Object.assign(cliente, dto);
    return await this.repo.save(cliente);
  }

  async eliminar(tenantId: string, id: string) {
    const cliente = await this.repo.findOne({ where: { id, tenantId } });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');

    cliente.activo = false;
    return this.repo.save(cliente);
  }

  async obtenerUno(tenantId: string, id: string) {
    const cliente = await this.repo.findOne({
      where: { id, tenantId, activo: true },
    });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');

    return cliente;
  }

  async buscar(tenantId: string, dto: FiltroClientesDto) {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 15;
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere('c.activo = true');

    if (dto.search) {
      qb.andWhere(
        `
    (c.razonSocial ILIKE :s OR
     c.cuit ILIKE :s OR 
     c.localidad ILIKE :s OR
     c.pais ILIKE :s)
    `,
        { s: `%${dto.search}%` },
      );
    }
    if (dto.pais) qb.andWhere('c.pais ILIKE :pais', { pais: `%${dto.pais}%` });

    if (dto.cuit) qb.andWhere('c.cuit = :cuit', { cuit: dto.cuit });

    if (dto.localidad)
      qb.andWhere('c.localidad ILIKE :loc', { loc: `%${dto.localidad}%` });

    qb.orderBy('c.razonSocial', 'ASC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }
}
