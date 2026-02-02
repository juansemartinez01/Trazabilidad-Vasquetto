// src/modules/trazabilidad/trazabilidad.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TrazabilidadController } from './trazabilidad.controller';
import { TrazabilidadService } from './trazabilidad.service';

import { LoteMP } from '../lotes/entities/lote-mp.entity';
import { LoteProductoFinal } from '../lotes/entities/lote-producto-final.entity';
import { OrdenConsumo } from '../orden-produccion/entities/orden-consumo.entity';
import { EntregaItem } from '../entregas/entities/entrega-item.entity';
import { Entrega } from '../entregas/entities/entrega.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LoteMP,
      LoteProductoFinal,
      OrdenConsumo,
      EntregaItem,
      Entrega,
    ]),
  ],
  controllers: [TrazabilidadController],
  providers: [TrazabilidadService],
  exports: [TrazabilidadService],
})
export class TrazabilidadModule {}
