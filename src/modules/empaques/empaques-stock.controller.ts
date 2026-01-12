import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { EmpaquesService } from './empaques.service';

@Controller('stock')
export class EmpaquesStockController {
  constructor(private service: EmpaquesService) {}

  @UseGuards(AuthGuard)
  @Get('presentaciones')
  resumen(@Req() req) {
    return this.service.resumenStockPresentaciones(req.tenantId);
  }
}
