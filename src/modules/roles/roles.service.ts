// src/modules/roles/roles.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rol } from './entities/roles.entity';
import { CreateRolDto } from './dto/create-rol.dto';
import { UpdateRolDto } from './dto/update-rol.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Rol)
    private rolesRepo: Repository<Rol>,
  ) {}

  async crear(tenantId: string, dto: CreateRolDto) {
    const existe = await this.rolesRepo.findOne({
      where: { tenantId, nombre: dto.nombre },
    });

    if (existe) {
      throw new BadRequestException(
        `Ya existe un rol con nombre ${dto.nombre} en este tenant`,
      );
    }

    const rol = this.rolesRepo.create({
      tenantId,
      nombre: dto.nombre,
    });

    return this.rolesRepo.save(rol);
  }

  listar(tenantId: string) {
    return this.rolesRepo.find({
      where: { tenantId },
      order: { nombre: 'ASC' },
    });
  }

  async obtenerUno(tenantId: string, id: string) {
    const rol = await this.rolesRepo.findOne({
      where: { id, tenantId },
    });

    if (!rol) {
      throw new NotFoundException('Rol no encontrado');
    }

    return rol;
  }

  async actualizar(tenantId: string, id: string, dto: UpdateRolDto) {
    const rol = await this.obtenerUno(tenantId, id);

    if (dto.nombre && dto.nombre !== rol.nombre) {
      const existe = await this.rolesRepo.findOne({
        where: { tenantId, nombre: dto.nombre },
      });
      if (existe) {
        throw new BadRequestException(
          `Ya existe un rol con nombre ${dto.nombre} en este tenant`,
        );
      }
      rol.nombre = dto.nombre;
    }

    return this.rolesRepo.save(rol);
  }

  async eliminar(tenantId: string, id: string) {
    const rol = await this.obtenerUno(tenantId, id);
    await this.rolesRepo.remove(rol);
    return { ok: true };
  }
}
