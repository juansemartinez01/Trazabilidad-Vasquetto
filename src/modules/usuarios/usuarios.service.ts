// src/modules/usuarios/usuarios.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Brackets } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { Usuario } from './entities/usuarios.entity';
import { Rol } from '../roles/entities/roles.entity';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { QueryUsuariosDto } from './dto/query-usuarios.dto';



function parseCSV(v?: string): string[] {
  if (!v) return [];
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}


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
      where: { tenantId, email: dto.email },
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

  /** Listar usuarios del tenant (filtros + paginado + orden) */
  async listar(tenantId: string, q: QueryUsuariosDto) {
    const page = Number(q.page ?? 1);
    const limit = Math.min(Number(q.limit ?? 20), 100);
    const all = String(q.all ?? 'false') === 'true';

    // roles: soporta rol=PRODUCCION o roles=PRODUCCION,ADMIN
    const rolesFiltro = [
      ...(q.rol ? [q.rol.trim()] : []),
      ...parseCSV(q.roles),
    ].map((x) => x.toUpperCase());

    const qb = this.usuariosRepo
      .createQueryBuilder('u')
      .where('u.tenant_id = :tenantId', { tenantId })
      .andWhere('u.activo = true')
      // join para filtrar y devolver roles
      .leftJoinAndSelect('u.roles', 'r');

    // ============================
    // Filtro q (nombre/email)
    // ============================
    if (q.q?.trim()) {
      const term = `%${q.q.trim()}%`;
      qb.andWhere(
        new Brackets((b) => {
          b.where('u.nombre ILIKE :term', { term }).orWhere(
            'u.email ILIKE :term',
            { term },
          );
        }),
      );
    }

    // ============================
    // Filtro por rol (nombre de rol)
    // - si mandás rolesFiltro, trae usuarios que tengan AL MENOS UNO de esos roles
    // ============================
    if (rolesFiltro.length) {
      qb.andWhere('UPPER(r.nombre) IN (:...roles)', { roles: rolesFiltro });
      // Importante: como join + where puede duplicar usuarios si tienen varios roles,
      // usamos distinct.
      qb.distinct(true);
    }

    // ============================
    // Orden seguro (whitelist)
    // ============================
    const sortDir = q.sortDir === 'ASC' ? 'ASC' : 'DESC';
    const sortMap: Record<string, string> = {
      createdAt: 'u.createdAt',
      nombre: 'u.nombre',
      email: 'u.email',
    };
    const sortCol = sortMap[q.sortBy ?? 'createdAt'] ?? 'u.createdAt';

    qb.orderBy(sortCol, sortDir as any).addOrderBy('u.id', 'DESC');

    // ============================
    // Paginado
    // ============================
    if (!all) {
      qb.skip((page - 1) * limit).take(limit);
    }

    const [data, total] = await qb.getManyAndCount();

    // seguridad extra: claveHash nunca viene por select:false, pero por las dudas:
    for (const u of data as any[]) delete u.claveHash;

    return {
      data,
      meta: all
        ? { total, all: true }
        : {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
            sortBy: q.sortBy ?? 'createdAt',
            sortDir,
          },
    };
  }

  async obtenerUno(tenantId: string, id: string) {
    const usuario = await this.usuariosRepo.findOne({
      where: { id, tenantId },
      relations: ['roles'],
    });

    if (!usuario || !usuario.activo) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return usuario; // claveHash no viene por select:false
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
        where: { tenantId, email: dto.email },
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
