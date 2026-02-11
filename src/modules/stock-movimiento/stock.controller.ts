import { Controller, Get, Param, Post, Body, Req, UseGuards, Query } from '@nestjs/common';
import { StockService } from './stock.service';
import { TipoMovimiento } from './entities/stock-movimiento.entity';
import { AuthGuard } from './../auth/guards/auth.guard';
import { RegistrarMermaDto } from './dto/registrar-merma.dto';
import { QueryResumenPfDto } from './dto/query-resumen-pf.dto';
import { QueryMovimientosDto } from './dto/query-movimientos.dto';

@Controller('stock')
@UseGuards(AuthGuard)
export class StockController {
  constructor(private service: StockService) {}

  @Get('alertas')
  alertas(@Req() req) {
    return this.service.alertasStock(req.tenantId);
  }

  @Get('movimientos')
  movimientos(@Req() req, @Query() q: QueryMovimientosDto) {
    return this.service.obtenerMovimientos(req.tenantId, q);
  }

  // 🔹 NUEVO: resumen stock materias primas
  @Get('resumen/mp')
  resumenMP(@Req() req) {
    return this.service.resumenStockMP(req.tenantId);
  }

  // 🔹 NUEVO: resumen stock producto final
  @Get('resumen/pf')
  resumenPF(@Req() req, @Query() q: QueryResumenPfDto) {
    return this.service.resumenStockPF(req.tenantId, q);
  }

  // ✅ NUEVO: MPs por debajo del mínimo
  @Get('minimos/mp/bajo')
  mpBajoMinimo(@Req() req) {
    return this.service.materiasPrimasBajoMinimo(req.tenantId);
  }

  // ✅ NUEVO: PFs por debajo del mínimo
  @Get('minimos/pf/bajo')
  pfBajoMinimo(@Req() req) {
    return this.service.productosFinalesBajoMinimo(req.tenantId);
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
