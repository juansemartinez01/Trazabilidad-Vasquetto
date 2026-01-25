import { Controller, Post, Body, Req, Get, UseGuards, Query, Patch, Param, Delete } from '@nestjs/common';
import { RecepcionesService } from './recepciones.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { QueryRecepcionesDto } from './dto/query-recepciones.dto';
import { UpdateRecepcionDto } from './dto/update-recepcion.dto';

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

  // ✅ NUEVO: editar cabecera de recepción (NO toca lotes)
  @UseGuards(AuthGuard)
  @Patch(':id')
  editar(@Param('id') id: string, @Body() dto: UpdateRecepcionDto, @Req() req) {
    return this.service.editarCabecera(req.tenantId, req.usuario.id, id, dto);
  }

  // ✅ NUEVO: eliminar recepción (reversión segura)
  @UseGuards(AuthGuard)
  @Delete(':id')
  eliminar(@Param('id') id: string, @Req() req) {
    return this.service.eliminar(req.tenantId, req.usuario.id, id);
  }
}
