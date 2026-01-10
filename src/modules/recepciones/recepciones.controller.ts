import { Controller, Post, Body, Req, Get, UseGuards, Query } from '@nestjs/common';
import { RecepcionesService } from './recepciones.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { QueryRecepcionesDto } from './dto/query-recepciones.dto';

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
  listar(@Req() req, @Query() q: QueryRecepcionesDto) {
    return this.service.obtenerTodasConFiltros(req.tenantId, q);
  }
}
