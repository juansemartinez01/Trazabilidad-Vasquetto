import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Req,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { InsumoService } from './insumo.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CreateInsumoDto } from './dto/create-insumo.dto';
import { UpdateInsumoDto } from './dto/update-insumo.dto';
import { AjusteStockDto, MovimientoStockDto } from './dto/movimiento-stock.dto';

@Controller('insumos')
export class InsumoController {
  constructor(private service: InsumoService) {}

  @UseGuards(AuthGuard)
  @Get()
  getAll(@Req() req) {
    return this.service.findAll(req.tenantId);
  }

  @UseGuards(AuthGuard)
  @Post()
  create(@Body() dto: CreateInsumoDto, @Req() req) {
    return this.service.create(req.tenantId, dto);
  }

  @UseGuards(AuthGuard)
  @Get(':id')
  getOne(@Param('id', new ParseUUIDPipe()) id: string, @Req() req) {
    return this.service.findOne(id, req.tenantId);
  }

  @UseGuards(AuthGuard)
  @Put(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateInsumoDto,
    @Req() req,
  ) {
    return this.service.update(id, req.tenantId, dto);
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  delete(@Param('id', new ParseUUIDPipe()) id: string, @Req() req) {
    return this.service.delete(id, req.tenantId);
  }

  // ---------------------------
  // Stock
  // ---------------------------

  @UseGuards(AuthGuard)
  @Post(':id/stock/ingreso')
  ingreso(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MovimientoStockDto,
    @Req() req,
  ) {
    return this.service.ingresoStock(req.tenantId, id, dto);
  }

  @UseGuards(AuthGuard)
  @Post(':id/stock/egreso')
  egreso(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MovimientoStockDto,
    @Req() req,
  ) {
    return this.service.egresoStock(req.tenantId, id, dto);
  }

  @UseGuards(AuthGuard)
  @Post(':id/stock/merma')
  merma(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MovimientoStockDto,
    @Req() req,
  ) {
    return this.service.mermaStock(req.tenantId, id, dto);
  }

  @UseGuards(AuthGuard)
  @Post(':id/stock/ajuste')
  ajuste(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AjusteStockDto,
    @Req() req,
  ) {
    return this.service.ajustarStock(req.tenantId, id, dto);
  }

  @UseGuards(AuthGuard)
  @Get(':id/movimientos')
  movimientos(@Param('id', new ParseUUIDPipe()) id: string, @Req() req) {
    return this.service.listarMovimientos(req.tenantId, id);
  }
}
