import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoteProductoFinal } from '../lotes/entities/lote-producto-final.entity';
import { LoteMP } from '../lotes/entities/lote-mp.entity';
import { OrdenConsumo } from '../orden-produccion/entities/orden-consumo.entity';
import { EntregaItem } from '../entregas/entities/entrega-item.entity';
import { MateriaPrima } from '../materia-prima/entities/materia-prima.entity';
import { StockMovimiento } from '../stock-movimiento/entities/stock-movimiento.entity';
import { MetricasService } from './metricas.service';
import { MetricasController } from './metricas.controller';


@Module({
  imports: [
    TypeOrmModule.forFeature([
      LoteProductoFinal,
      LoteMP,
      OrdenConsumo,
      EntregaItem,
      StockMovimiento,
      MateriaPrima,
    ]),
  ],
  providers: [MetricasService],
  controllers: [MetricasController],
})
export class MetricasModule {}
