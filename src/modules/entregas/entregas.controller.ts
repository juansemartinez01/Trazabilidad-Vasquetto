import { AuthGuard } from "../auth/guards/auth.guard";
import { QueryEntregasDto } from "./dto/query-entregas.dto";
import { EntregasService } from "./entregas.service";
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  Put,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';


@Controller('entregas')
@UseGuards(AuthGuard)
export class EntregasController {
  constructor(private service: EntregasService) {}

  @Post()
  crear(@Req() req, @Body() dto) {
    return this.service.crear(req.tenantId, req.usuario.id, dto);
  }

  @Get()
  listar(@Req() req, @Query() q: QueryEntregasDto) {
    return this.service.listar(req.tenantId, q);
  }

  @Get(':id')
  obtener(@Req() req, @Param('id') id: string) {
    return this.service.obtener(req.tenantId, id);
  }

  @Get('cliente/:clienteId/historial')
  historial(@Req() req, @Param('clienteId') clienteId: string) {
    return this.service.historialPorCliente(req.tenantId, clienteId);
  }

  @Get('lote/:loteId/trazabilidad-forward')
  trazabilidadForward(@Req() req, @Param('loteId') loteId: string) {
    return this.service.trazabilidadForwardLote(req.tenantId, loteId);
  }
}
