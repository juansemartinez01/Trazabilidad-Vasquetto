import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Usuario } from '../usuarios/entities/usuarios.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { Rol } from '../roles/entities/roles.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario)
    private usuariosRepo: Repository<Usuario>,

    @InjectRepository(Rol)
    private rolesRepo: Repository<Rol>,
  ) {}

  async registrar(dto, tenantId: string) {
    const roles = await this.rolesRepo.findByIds(dto.roles);

    const claveHash = await bcrypt.hash(dto.password, 10);

    const usuario = this.usuariosRepo.create({
      nombre: dto.nombre,
      email: dto.email,
      claveHash,
      roles,
      tenantId,
    });

    await this.usuariosRepo.save(usuario);

    return usuario;
  }

  async login(email: string, password: string, tenantId: string) {
    const usuario = await this.usuariosRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.roles', 'r')
      .addSelect('u.claveHash') // 👈 porque está select:false
      .where('u.email = :email', { email })
      .andWhere('u.tenant_id = :tenantId', { tenantId })
      .andWhere('u.activo = true')
      .getOne();

    if (!usuario) throw new UnauthorizedException('Credenciales inválidas');

    const ok = await bcrypt.compare(password, usuario.claveHash);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is not defined');
    }

    // ⚠️ no metas objetos enteros de roles en el token, mete nombres o ids
    const roles = (usuario.roles ?? []).map((x) => x.nombre);

    const token = jwt.sign(
      {
        id: usuario.id,
        nombre: usuario.nombre,
        roles, // 👈 solo nombres
        tenantId: usuario.tenantId,
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' },
    );

    // ✅ limpiar hash antes de devolver
    delete (usuario as any).claveHash;

    return { token, usuario };
  }
}
