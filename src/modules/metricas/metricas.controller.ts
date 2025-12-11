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
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { MetricasService } from './metricas.service';
import { DashboardMetricsDto } from './dto/dashboard-metrics.dto';


@Controller('metricas')
@UseGuards(AuthGuard)
export class MetricasController {
  constructor(private service: MetricasService) {}

  @Post('dashboard')
  dashboard(@Body() dto: DashboardMetricsDto, @Req() req) {
    return this.service.dashboard(req.tenantId, dto);
  }
}
