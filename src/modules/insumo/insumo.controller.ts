import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Req,
  Param,
  Body,
} from '@nestjs/common';
import { InsumoService } from './insumo.service';

@Controller('insumos')
export class InsumoController {
  constructor(private service: InsumoService) {}

  @Get()
  getAll(@Req() req) {
    return this.service.findAll(req.tenantId);
  }

  @Post()
  create(@Body() dto, @Req() req) {
    return this.service.create(req.tenantId, dto);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @Req() req) {
    return this.service.findOne(id, req.tenantId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto, @Req() req) {
    return this.service.update(id, req.tenantId, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req) {
    return this.service.delete(id, req.tenantId);
  }
}
