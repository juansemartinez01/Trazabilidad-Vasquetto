import { Controller, Get, Post, Body, Req, UseGuards, Put } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ConfiguracionService } from './configuracion.service';
import { SetConfiguracionOperativaDto } from './dto/set-configuracion-operativa.dto';
import { SetStockMinimoMpDto } from './dto/set-stock-minimo-mp.dto';
import { SetStockMinimoPfDto } from './dto/set-stock-minimo-pf.dto';

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

  // =========================
  //   STOCK MINIMO MP
  // =========================

  @Get('stock-minimo/mp')
  listarMinimosMP(@Req() req) {
    return this.service.listarStockMinimoMP(req.tenantId);
  }

  // ✅ Crear/Actualizar (upsert)
  @Post('stock-minimo/mp')
  setMinimoMP(@Req() req, @Body() dto: SetStockMinimoMpDto) {
    return this.service.setStockMinimoMP(
      req.tenantId,
      dto.materiaPrimaId,
      dto.stockMinKg,
    );
  }

  // ✅ Alias semántico "update"
  @Put('stock-minimo/mp')
  updateMinimoMP(@Req() req, @Body() dto: SetStockMinimoMpDto) {
    return this.service.setStockMinimoMP(
      req.tenantId,
      dto.materiaPrimaId,
      dto.stockMinKg,
    );
  }

  // =========================
  //   STOCK MINIMO PF
  // =========================

  @Get('stock-minimo/pf')
  listarMinimosPF(@Req() req) {
    return this.service.listarStockMinimoPF(req.tenantId);
  }

  // ✅ Crear/Actualizar (upsert)
  @Post('stock-minimo/pf')
  setMinimoPF(@Req() req, @Body() dto: SetStockMinimoPfDto) {
    return this.service.setStockMinimoPF(
      req.tenantId,
      dto.productoFinalId,
      dto.stockMinKg,
    );
  }

  // ✅ Alias semántico "update"
  @Put('stock-minimo/pf')
  updateMinimoPF(@Req() req, @Body() dto: SetStockMinimoPfDto) {
    return this.service.setStockMinimoPF(
      req.tenantId,
      dto.productoFinalId,
      dto.stockMinKg,
    );
  }
}
