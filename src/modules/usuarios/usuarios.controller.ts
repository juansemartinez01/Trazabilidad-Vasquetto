// src/modules/usuarios/usuarios.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { QueryUsuariosDto } from './dto/query-usuarios.dto';

@Controller('usuarios')
@UseGuards(AuthGuard)
export class UsuariosController {
  constructor(private readonly service: UsuariosService) {}

  @Post()
  crear(@Req() req, @Body() dto: CreateUsuarioDto) {
    return this.service.crear(req.tenantId, dto);
  }

  @Get()
  listar(@Req() req, @Query() q: QueryUsuariosDto) {
    return this.service.listar(req.tenantId, q);
  }

  @Get(':id')
  obtenerUno(@Req() req, @Param('id') id: string) {
    return this.service.obtenerUno(req.tenantId, id);
  }

  @Patch(':id')
  actualizar(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateUsuarioDto,
  ) {
    return this.service.actualizar(req.tenantId, id, dto);
  }

  @Delete(':id')
  eliminar(@Req() req, @Param('id') id: string) {
    return this.service.eliminar(req.tenantId, id);
  }
}
