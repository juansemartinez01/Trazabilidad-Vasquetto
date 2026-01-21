import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { TransferenciasService } from './transferencias.service';
import { CreateTransferenciaDto } from './dto/create-transferencia.dto';

@Controller('transferencias')
@UseGuards(AuthGuard)
export class TransferenciasController {
  constructor(private readonly service: TransferenciasService) {}

  @Post()
  crear(@Req() req, @Body() dto: CreateTransferenciaDto) {
    return this.service.crear(req.tenantId, req.user?.id ?? null, dto);
  }

  @Post(':id/confirmar')
  confirmar(@Req() req, @Param('id') id: string) {
    return this.service.confirmar(req.tenantId, req.user?.id ?? null, id);
  }

  @Get()
  listar(@Req() req) {
    return this.service.listar(req.tenantId);
  }

  @Get(':id')
  obtener(@Req() req, @Param('id') id: string) {
    return this.service.obtener(req.tenantId, id);
  }
}
