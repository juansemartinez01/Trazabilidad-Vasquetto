// src/modules/insumos/insumo-consumo-pf.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Req,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { InsumoConsumoPfService } from './insumo-consumo-pf.service';
import { CreateInsumoConsumoPfDto } from './dto/create-insumo-consumo-pf.dto';
import { UpdateInsumoConsumoPfDto } from './dto/update-insumo-consumo-pf.dto';
import { CalcularConsumoInsumosDto } from './dto/calcular-consumo-insumos.dto';
import { QueryInsumoConsumoPfDto } from './dto/query-insumo-consumo-pf.dto';

@Controller('insumos/consumos-pf')
@UseGuards(AuthGuard)
export class InsumoConsumoPfController {
  constructor(private service: InsumoConsumoPfService) {}

  // GET /insumos/consumos-pf/presentaciones-sin-reglas
  @Get('paginado-sin-reglas')
  listarPaginadoSinReglas(@Req() req, @Query() query: QueryInsumoConsumoPfDto) {
    return this.service.listarPaginadoSinReglas(req.tenantId, query);
  }

  @Get('paginado')
  listarPaginado(@Req() req, @Query() query: QueryInsumoConsumoPfDto) {
    return this.service.listarPaginado(req.tenantId, query);
  }

  @Get()
  listar(
    @Req() req,
    @Query('productoFinalId') productoFinalId?: string,
    @Query('presentacionId') presentacionId?: string,
  ) {
    return this.service.listar(req.tenantId, {
      productoFinalId,
      presentacionId,
    });
  }

  @Get(':id')
  getOne(@Req() req, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getOne(req.tenantId, id);
  }

  @Post()
  crear(@Req() req, @Body() dto: CreateInsumoConsumoPfDto) {
    return this.service.crear(req.tenantId, dto);
  }

  @Put(':id')
  update(
    @Req() req,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateInsumoConsumoPfDto,
  ) {
    return this.service.update(req.tenantId, id, dto);
  }

  @Delete(':id')
  delete(@Req() req, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.delete(req.tenantId, id);
  }

  // ✅ “qué insumos aplica y cuánto necesito”
  @Post('calcular')
  calcular(@Req() req, @Body() dto: CalcularConsumoInsumosDto) {
    return this.service.calcularConsumo(req.tenantId, dto);
  }
}
