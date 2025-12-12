import { Controller, Get, Param, Post, Body, Req, UseGuards } from '@nestjs/common';
import { StockService } from './stock.service';
import { TipoMovimiento } from './entities/stock-movimiento.entity';
import { AuthGuard } from './../auth/guards/auth.guard';
import { RegistrarMermaDto } from './dto/registrar-merma.dto';

@Controller('stock')
@UseGuards(AuthGuard)
export class StockController {
  constructor(private service: StockService) {}

  @Get('alertas')
  alertas(@Req() req) {
    return this.service.alertasStock(req.tenantId);
  }

  @Post('ajustar/:loteId')
  ajustar(@Param('loteId') loteId: string, @Req() req, @Body() body) {
    return this.service.ajustarStock(
      req.tenantId,
      loteId,
      body.cantidadAjuste,
      body.motivo,
    );
  }

  // 🔹 NUEVO: merma sobre materia prima (LoteMP)
  @Post('mermas/mp/:loteId')
  mermaMP(
    @Param('loteId') loteId: string,
    @Req() req,
    @Body() dto: RegistrarMermaDto,
  ) {
    return this.service.registrarMermaMP(req.tenantId, loteId, dto);
  }

  @Post('mermas/pf/:loteId')
  mermaPF(
    @Param('loteId') loteId: string,
    @Req() req,
    @Body() dto: RegistrarMermaDto,
  ) {
    return this.service.registrarMermaPF(req.tenantId, loteId, dto);
  }
}
