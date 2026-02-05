import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EstadisticasController } from './estadisticas.controller';
import { EstadisticasService } from './estadisticas.service';
import { LoteProductoFinal } from '../lotes/entities/lote-producto-final.entity';
import { Cliente } from '../clientes/entities/cliente.entity';
import { EntregaItem } from '../entregas/entities/entrega-item.entity';
import { Entrega } from '../entregas/entities/entrega.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LoteProductoFinal,
      LoteProductoFinal,
      Entrega,
      EntregaItem,
      Cliente,
    ]),
  ],
  controllers: [EstadisticasController],
  providers: [EstadisticasService],
})
export class EstadisticasModule {}
