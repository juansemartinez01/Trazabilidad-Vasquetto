import { Controller, Get, Req, BadRequestException, Patch, Param, Body, Query } from '@nestjs/common';
import { LotesService } from './lotes.service';
import { CambiarEstadoLotePfDto } from './dto/cambiar-estado-lote-pf.dto';
import { QueryLotesPfDto } from './dto/query-lotes-pf.dto';
import { QueryLotesMpDto } from './dto/query-lotes-mp.dto';

@Controller('lotes')
export class LotesController {
  constructor(private lotesService: LotesService) {}

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

  /** =============================
   *  LISTAR LOTES DE MATERIA PRIMA
   ============================== */
  @Get('mp')
  listarMP(@Req() req, @Query() q: QueryLotesMpDto) {
    const tenantId = this.getTenantId(req);
    return this.lotesService.listarLotesMP(tenantId, q);
  }

  /** =============================
   *  LISTAR LOTES DE PRODUCTO FINAL
   ============================== */
  @Get('pf')
  listarPF(@Req() req, @Query() q: QueryLotesPfDto) {
    const tenantId = this.getTenantId(req);
    return this.lotesService.listarLotesPF(tenantId, q);
  }

  @Patch('pf/:id/estado')
  cambiarEstadoPF(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: CambiarEstadoLotePfDto,
  ) {
    const tenantId = this.getTenantId(req);
    return this.lotesService.cambiarEstadoPF(tenantId, id, dto);
  }
}
