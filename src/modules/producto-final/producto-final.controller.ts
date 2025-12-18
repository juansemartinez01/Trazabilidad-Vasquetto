// src/modules/producto-final/producto-final.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ProductoFinalService } from './producto-final.service';
import { CreateProductoFinalDto } from './dto/create-producto-final.dto';
import { UpdateProductoFinalDto } from './dto/update-producto-final.dto';

@Controller('productos-finales')
@UseGuards(AuthGuard)
export class ProductoFinalController {
  constructor(private service: ProductoFinalService) {}

  @Post()
  crear(@Req() req, @Body() dto: CreateProductoFinalDto) {
    return this.service.crear(req.tenantId, dto);
  }

  @Get()
  listar(@Req() req) {
    return this.service.listar(req.tenantId);
  }

  @Get(':id')
  obtener(@Req() req, @Param('id') id: string) {
    return this.service.obtener(req.tenantId, id);
  }

  @Patch(':id')
  actualizar(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateProductoFinalDto,
  ) {
    return this.service.actualizar(req.tenantId, id, dto);
  }

  @Delete(':id')
  eliminar(@Req() req, @Param('id') id: string) {
    return this.service.eliminar(req.tenantId, id);
  }
}
