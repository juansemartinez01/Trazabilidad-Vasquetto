import { Controller, Get, Param, Post, Body, Req, UseGuards } from '@nestjs/common';
import { StockService } from './stock.service';
import { TipoMovimiento } from './entities/stock-movimiento.entity';
import { AuthGuard } from './../auth/guards/auth.guard';

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
}
