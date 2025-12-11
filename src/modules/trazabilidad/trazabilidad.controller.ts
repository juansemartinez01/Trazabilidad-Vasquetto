import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from './../auth/guards/auth.guard';
import { TrazabilidadService } from './trazabilidad.service';

@Controller('trazabilidad')
@UseGuards(AuthGuard)
export class TrazabilidadController {
  constructor(private service: TrazabilidadService) {}

  @Get('pf/:id')
  trazabilidadPF(@Req() req, @Param('id') id: string) {
    return this.service.trazabilidadPF(req.tenantId, id);
  }

  @Get('mp/:id')
  trazabilidadMP(@Req() req, @Param('id') id: string) {
    return this.service.trazabilidadMP(req.tenantId, id);
  }

  @Get('cliente/:id')
  trazabilidadCliente(@Req() req, @Param('id') id: string) {
    return this.service.trazabilidadCliente(req.tenantId, id);
  }

  @Get('buscar/:id')
  buscar(@Req() req, @Param('id') id: string) {
    return this.service.buscar(req.tenantId, id);
  }
}
