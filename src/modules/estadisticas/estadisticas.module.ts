import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EstadisticasController } from './estadisticas.controller';
import { EstadisticasService } from './estadisticas.service';
import { LoteProductoFinal } from '../lotes/entities/lote-producto-final.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LoteProductoFinal])],
  controllers: [EstadisticasController],
  providers: [EstadisticasService],
})
export class EstadisticasModule {}
