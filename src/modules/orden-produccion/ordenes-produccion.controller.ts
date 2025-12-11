import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrdenesProduccionService } from './ordenes-produccion.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('produccion/ordenes')
@UseGuards(AuthGuard)
export class OrdenesProduccionController {
  constructor(private service: OrdenesProduccionService) {}

  @Post()
  crear(@Req() req, @Body() dto) {
    return this.service.crear(req.tenantId, req.usuario.id, dto);
  }

  @Post(':id/procesar')
  procesar(@Req() req, @Param('id') id: string, @Body() body) {
    return this.service.procesar(
      req.tenantId,
      req.usuario.id,
      id,
      body.depositoDestinoId,
    );
  }

  @Get()
  listar(@Req() req) {
    return this.service.listar(req.tenantId);
  }

  @Get(':id')
  obtener(@Req() req, @Param('id') id: string) {
    return this.service.obtener(req.tenantId, id);
  }
}
