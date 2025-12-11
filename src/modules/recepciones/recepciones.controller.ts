import { Controller, Post, Body, Req, Get, UseGuards } from '@nestjs/common';
import { RecepcionesService } from './recepciones.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('recepciones')
export class RecepcionesController {
  constructor(private service: RecepcionesService) {}

  @UseGuards(AuthGuard)
  @Post()
  crear(@Body() dto, @Req() req) {
    return this.service.crear(req.tenantId, req.usuario.id, dto);
  }

  @UseGuards(AuthGuard)
  @Get()
  listar(@Req() req) {
    return this.service.findAll(req.tenantId);
  }
}
