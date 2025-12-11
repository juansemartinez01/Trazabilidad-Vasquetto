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
} from '@nestjs/common';

import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { FiltroClientesDto } from './dto/filtro-clientes.dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('clientes')
@UseGuards(AuthGuard)
export class ClientesController {
  constructor(private service: ClientesService) {}

  @Post()
  crear(@Req() req, @Body() dto: CreateClienteDto) {
    return this.service.crear(req.tenantId, dto);
  }

  @Patch(':id')
  actualizar(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateClienteDto,
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
  buscar(@Req() req, @Query() dto: FiltroClientesDto) {
    return this.service.buscar(req.tenantId, dto);
  }
}
