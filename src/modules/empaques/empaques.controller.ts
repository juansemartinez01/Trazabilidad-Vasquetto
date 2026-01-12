import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Param,
  Get,
  Query,
  Delete,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { EmpaquesService } from './empaques.service';
import { CreateEmpaqueDto } from './dto/create-empaque.dto';
import { AddEmpaqueItemDto } from './dto/add-empaque-item.dto';
import { QueryEmpaquesDto } from './dto/query-empaques.dto';

@Controller('empaques')
export class EmpaquesController {
  constructor(private service: EmpaquesService) {}

  @UseGuards(AuthGuard)
  @Post()
  crear(@Req() req, @Body() dto: CreateEmpaqueDto) {
    return this.service.crear(req.tenantId, req.usuario.id, dto);
  }

  @UseGuards(AuthGuard)
  @Post(':id/items')
  agregarItem(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: AddEmpaqueItemDto,
  ) {
    return this.service.agregarItem(req.tenantId, req.usuario.id, id, dto);
  }

  @UseGuards(AuthGuard)
  @Delete(':id/items/:itemId')
  quitarItem(
    @Req() req,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.service.quitarItem(req.tenantId, req.usuario.id, id, itemId);
  }

  @UseGuards(AuthGuard)
  @Post(':id/confirmar')
  confirmar(@Req() req, @Param('id') id: string) {
    return this.service.confirmar(req.tenantId, req.usuario.id, id);
  }

  @UseGuards(AuthGuard)
  @Get()
  listar(@Req() req, @Query() q: QueryEmpaquesDto) {
    return this.service.listar(req.tenantId, q);
  }

  @UseGuards(AuthGuard)
  @Get(':id')
  obtener(@Req() req, @Param('id') id: string) {
    return this.service.obtener(req.tenantId, id);
  }
}
