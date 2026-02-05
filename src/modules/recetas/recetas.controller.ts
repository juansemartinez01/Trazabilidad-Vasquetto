import {
  Controller,
  Post,
  Put,
  Get,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RecetasService } from './recetas.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('recetas')
@UseGuards(AuthGuard)
export class RecetasController {
  constructor(private service: RecetasService) {}

  @Post()
  crear(@Body() dto, @Req() req) {
    return this.service.crear(req.tenantId, req.usuario.id, dto);
  }

  @Post(':recetaId/versiones/:versionId/activar')
  activarVersion(
    @Param('recetaId') recetaId: string,
    @Param('versionId') versionId: string,
    @Req() req,
  ) {
    return this.service.activarVersion(
      req.tenantId,
      recetaId,
      versionId,
      req.usuario.id,
    );
  }

  @Put(':id')
  actualizar(@Param('id') recetaId: string, @Body() dto, @Req() req) {
    return this.service.actualizar(req.tenantId, recetaId, req.usuario.id, dto);
  }

  @Get()
  listar(@Req() req) {
    return this.service.findAll(req.tenantId);
  }

  @Get(':id')
  obtener(@Param('id') id: string, @Req() req) {
    return this.service.findOne(id, req.tenantId);
  }

  @Post('calcular/:id')
  calcular(@Param('id') recetaId: string, @Req() req, @Body() body) {
    return this.service.calcularNecesidades(
      req.tenantId,
      recetaId,
      body.cantidadKg,
    );
  }
}
