import {
  Controller,
  Get,
  Req,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { EstadisticasService } from './estadisticas.service';
import { QueryEstadisticasProduccionDto } from './dto/query-estadisticas-produccion.dto';
import { QueryTortaProduccionDto } from './dto/query-torta-produccion.dto';
import { QueryEstadisticasClientesDto } from './dto/query-estadisticas-clientes.dto';
import { QueryEstadisticasProveedoresDto } from './dto/query-estadisticas-proveedores.dto';

@Controller('estadisticas')
export class EstadisticasController {
  constructor(private readonly service: EstadisticasService) {}

  private getTenantId(req: any): string {
    const fromUser = req.user?.tenantId;
    const fromHeader = req.headers['x-tenant-id'] || req.headers['tenant-id'];
    const tenantId = fromUser || fromHeader;

    if (!tenantId) {
      throw new BadRequestException(
        'tenantId no encontrado (ni en token ni en header x-tenant-id)',
      );
    }
    return String(tenantId);
  }

  @Get('produccion')
  produccion(@Req() req, @Query() q: QueryEstadisticasProduccionDto) {
    const tenantId = this.getTenantId(req);
    return this.service.produccion(tenantId, q);
  }

  @Get('produccion/torta')
  tortaProduccion(@Req() req, @Query() q: QueryTortaProduccionDto) {
    const tenantId = this.getTenantId(req);
    return this.service.tortaProduccion(tenantId, q);
  }

  @Get('clientes')
  clientes(@Req() req, @Query() q: QueryEstadisticasClientesDto) {
    const tenantId = this.getTenantId(req);
    return this.service.clientes(tenantId, q);
  }

  @Get('proveedores')
  proveedores(@Req() req, @Query() q: QueryEstadisticasProveedoresDto) {
    const tenantId = this.getTenantId(req);
    return this.service.proveedores(tenantId, q);
  }
}
