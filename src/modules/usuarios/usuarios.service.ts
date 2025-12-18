// src/modules/usuarios/usuarios.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { Usuario } from './entities/usuarios.entity';
import { Rol } from '../roles/entities/roles.entity';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private usuariosRepo: Repository<Usuario>,
    @InjectRepository(Rol)
    private rolesRepo: Repository<Rol>,
  ) {}

  /** Crear usuario (tipo admin panel) */
  async crear(tenantId: string, dto: CreateUsuarioDto) {
    const existente = await this.usuariosRepo.findOne({
      where: { email: dto.email },
    });
    if (existente) {
      throw new BadRequestException(
        `Ya existe un usuario con el email ${dto.email}`,
      );
    }

    let roles: Rol[] = [];
    if (dto.roles?.length) {
      roles = await this.rolesRepo.find({
        where: {
          id: In(dto.roles),
          tenantId,
        },
      });

      if (roles.length !== dto.roles.length) {
        throw new BadRequestException(
          'Alguno de los roles no existe o no pertenece a este tenant',
        );
      }
    }

    const claveHash = await bcrypt.hash(dto.password, 10);

    const usuario = this.usuariosRepo.create({
      tenantId,
      nombre: dto.nombre,
      email: dto.email,
      claveHash,
      roles,
      activo: true,
    });

    const saved = await this.usuariosRepo.save(usuario);
    // no devolver hash
    delete (saved as any).claveHash;
    return saved;
  }

  /** Listar usuarios del tenant */
  listar(tenantId: string) {
    return this.usuariosRepo.find({
      where: { tenantId, activo: true },
    });
  }

  /** Obtener un usuario por id */
  async obtenerUno(tenantId: string, id: string) {
    const usuario = await this.usuariosRepo.findOne({
      where: { id, tenantId },
    });

    if (!usuario || !usuario.activo) {
      throw new NotFoundException('Usuario no encontrado');
    }

    delete (usuario as any).claveHash;
    return usuario;
  }

  /** Actualizar usuario (nombre, email, roles, password) */
  async actualizar(tenantId: string, id: string, dto: UpdateUsuarioDto) {
    const usuario = await this.usuariosRepo.findOne({
      where: { id, tenantId },
      relations: ['roles'],
    });

    if (!usuario || !usuario.activo) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (dto.email && dto.email !== usuario.email) {
      const conflicto = await this.usuariosRepo.findOne({
        where: { email: dto.email },
      });
      if (conflicto) {
        throw new BadRequestException(
          `Ya existe un usuario con el email ${dto.email}`,
        );
      }
      usuario.email = dto.email;
    }

    if (dto.nombre) usuario.nombre = dto.nombre;

    if (dto.password) {
      usuario.claveHash = await bcrypt.hash(dto.password, 10);
    }

    if (dto.roles) {
      const roles = await this.rolesRepo.find({
        where: { id: In(dto.roles), tenantId },
      });

      if (roles.length !== dto.roles.length) {
        throw new BadRequestException(
          'Alguno de los roles no existe o no pertenece a este tenant',
        );
      }

      usuario.roles = roles;
    }

    const saved = await this.usuariosRepo.save(usuario);
    delete (saved as any).claveHash;
    return saved;
  }

  /** Eliminar (baja lógica) */
  async eliminar(tenantId: string, id: string) {
    const usuario = await this.usuariosRepo.findOne({
      where: { id, tenantId },
    });

    if (!usuario || !usuario.activo) {
      throw new NotFoundException('Usuario no encontrado');
    }

    usuario.activo = false;
    await this.usuariosRepo.save(usuario);

    return { ok: true };
  }
}
