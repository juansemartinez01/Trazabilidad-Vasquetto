import { Controller, Get, Req, BadRequestException } from '@nestjs/common';
import { LotesService } from './lotes.service';

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
  listarMP(@Req() req) {
    const tenantId = this.getTenantId(req);
    return this.lotesService.listarLotesMP(tenantId);
  }

  /** =============================
   *  LISTAR LOTES DE PRODUCTO FINAL
   ============================== */
  @Get('pf')
  listarPF(@Req() req) {
    const tenantId = this.getTenantId(req);
    return this.lotesService.listarLotesPF(tenantId);
  }
}
