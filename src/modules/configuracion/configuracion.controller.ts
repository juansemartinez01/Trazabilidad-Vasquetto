import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ConfiguracionService } from './configuracion.service';
import { SetConfiguracionOperativaDto } from './dto/set-configuracion-operativa.dto';
import { SetStockMinimoMpDto } from './dto/set-stock-minimo-mp.dto';

@Controller('configuracion')
@UseGuards(AuthGuard)
export class ConfiguracionController {
  constructor(private service: ConfiguracionService) {}

  @Get('operativa')
  getOperativa(@Req() req) {
    return this.service.getOperativa(req.tenantId);
  }

  @Post('operativa')
  setOperativa(@Req() req, @Body() dto: SetConfiguracionOperativaDto) {
    return this.service.setOperativa(req.tenantId, dto);
  }

  @Get('stock-minimo/mp')
  listarMinimosMP(@Req() req) {
    return this.service.listarStockMinimoMP(req.tenantId);
  }

  @Post('stock-minimo/mp')
  setMinimoMP(@Req() req, @Body() dto: SetStockMinimoMpDto) {
    return this.service.setStockMinimoMP(
      req.tenantId,
      dto.materiaPrimaId,
      dto.stockMinKg,
    );
  }
}
