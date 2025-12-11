import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoteMP } from '../lotes/entities/lote-mp.entity';

import { Deposito } from '../deposito/entities/deposito.entity';
import { LoteProductoFinal } from '../lotes/entities/lote-producto-final.entity';
import { OrdenProduccion } from '../orden-produccion/entities/orden-produccion.entity';
import { OrdenConsumo } from '../orden-produccion/entities/orden-consumo.entity';
import { EntregaItem } from '../entregas/entities/entrega-item.entity';
import { TrazabilidadService } from './trazabilidad.service';
import { TrazabilidadController } from './trazabilidad.controller';
import { Cliente } from '../clientes/entities/cliente.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LoteMP,
      LoteProductoFinal,
      OrdenProduccion,
      OrdenConsumo,
      EntregaItem,
      Cliente,
    ]),
  ],
  providers: [TrazabilidadService],
  controllers: [TrazabilidadController],
})
export class TrazabilidadModule {}
