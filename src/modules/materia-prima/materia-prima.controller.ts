import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  Put,
  Delete,
} from '@nestjs/common';
import { MateriaPrimaService } from './materia-prima.service';

@Controller('materias-primas')
export class MateriaPrimaController {
  constructor(private service: MateriaPrimaService) {}

  @Get()
  getAll(@Req() req) {
    return this.service.findAll(req.tenantId);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @Req() req) {
    return this.service.findOne(id, req.tenantId);
  }

  @Post()
  create(@Body() dto, @Req() req) {
    return this.service.create(req.tenantId, dto);
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
