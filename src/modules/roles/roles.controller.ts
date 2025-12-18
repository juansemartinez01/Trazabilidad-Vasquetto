// src/modules/roles/roles.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesService } from './roles.service';
import { CreateRolDto } from './dto/create-rol.dto';
import { UpdateRolDto } from './dto/update-rol.dto';

@Controller('roles')
@UseGuards(AuthGuard)
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Post()
  crear(@Req() req, @Body() dto: CreateRolDto) {
    return this.service.crear(req.tenantId, dto);
  }

  @Get()
  listar(@Req() req) {
    return this.service.listar(req.tenantId);
  }

  @Get(':id')
  obtenerUno(@Req() req, @Param('id') id: string) {
    return this.service.obtenerUno(req.tenantId, id);
  }

  @Patch(':id')
  actualizar(@Req() req, @Param('id') id: string, @Body() dto: UpdateRolDto) {
    return this.service.actualizar(req.tenantId, id, dto);
  }

  @Delete(':id')
  eliminar(@Req() req, @Param('id') id: string) {
    return this.service.eliminar(req.tenantId, id);
  }
}
