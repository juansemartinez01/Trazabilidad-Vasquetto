import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  Put,
} from '@nestjs/common';

import { ProveedoresService } from './proveedores.service';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { FiltroProveedoresDto } from './dto/filtro-proveedores.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { SetProveedorMateriasPrimasDto } from './dto/set-proveedor-materias-primas.dto';

@Controller('proveedores')
@UseGuards(AuthGuard)
export class ProveedoresController {
  constructor(private service: ProveedoresService) {}

  @Post()
  crear(@Req() req, @Body() dto: CreateProveedorDto) {
    return this.service.crear(req.tenantId, dto);
  }

  @Patch(':id')
  actualizar(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateProveedorDto,
  ) {
    return this.service.actualizar(req.tenantId, id, dto);
  }

  @Delete(':id')
  eliminar(@Req() req, @Param('id') id: string) {
    return this.service.eliminar(req.tenantId, id);
  }

  @Get(':id')
  obtenerUno(@Req() req, @Param('id') id: string) {
    return this.service.obtenerUno(req.tenantId, id);
  }

  @Get()
  buscar(@Req() req, @Query() dto: FiltroProveedoresDto) {
    return this.service.buscar(req.tenantId, dto);
  }

  @Put(':id/materias-primas')
  setMateriasPrimas(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: SetProveedorMateriasPrimasDto,
  ) {
    return this.service.setMateriasPrimas(
      req.tenantId,
      id,
      dto.materiaPrimaIds,
    );
  }
}
