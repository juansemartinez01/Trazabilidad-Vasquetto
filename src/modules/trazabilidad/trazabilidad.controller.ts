// src/modules/trazabilidad/trazabilidad.controller.ts
import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from './../auth/guards/auth.guard';
import { TrazabilidadService } from './trazabilidad.service';

@Controller('trazabilidad')
@UseGuards(AuthGuard)
export class TrazabilidadController {
  constructor(private readonly service: TrazabilidadService) {}

  // MP -> PF -> Clientes/Entregas
  @Get('grafo/mp/:id')
  grafoDesdeMP(@Req() req, @Param('id') id: string) {
    return this.service.grafoDesdeMP(req.tenantId, id);
  }

  // Entrega -> PF -> MP
  @Get('grafo/entrega/:id')
  grafoDesdeEntrega(@Req() req, @Param('id') id: string) {
    return this.service.grafoDesdeEntrega(req.tenantId, id);
  }

  // PF (completo): backward MP + forward clientes/entregas
  @Get('grafo/pf/:id')
  grafoDesdePF(@Req() req, @Param('id') id: string) {
    return this.service.grafoDesdePF(req.tenantId, id);
  }

  // Buscador unificado (id puede ser lote MP, lote PF o entrega)
  @Get('buscar/:id')
  buscar(@Req() req, @Param('id') id: string) {
    return this.service.buscar(req.tenantId, id);
  }
}
