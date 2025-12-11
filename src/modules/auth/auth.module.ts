import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../usuarios/entities/usuarios.entity';
import { Rol } from '../roles/entities/roles.entity';
import { Auditoria } from '../auditoria/entities/auditoria.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuditoriaService } from '../auditoria/auditoria.service';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Rol, Auditoria])],
  controllers: [AuthController],
  providers: [AuthService, AuditoriaService],
  exports: [AuthService],
})
export class AuthModule {}
