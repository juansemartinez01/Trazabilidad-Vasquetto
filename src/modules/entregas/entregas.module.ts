import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entrega } from './entities/entrega.entity';
import { EntregaItem } from './entities/entrega-item.entity';
import { LoteProductoFinal } from '../lotes/entities/lote-producto-final.entity';
import { Deposito } from '../deposito/entities/deposito.entity';
import { EntregasController } from './entregas.controller';
import { EntregasService } from './entregas.service';

import { Cliente } from '../clientes/entities/cliente.entity';
import { StockModule } from '../stock-movimiento/stock.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { PresentacionProductoFinal } from '../producto-final/entities/presentacion-producto-final.entity';
import { StockMovimiento } from '../stock-movimiento/entities/stock-movimiento.entity';
import { StockPresentacion } from '../empaques/entities/stock-presentacion.entity';
import { PFUnidadEnvasada } from '../empaques/entities/pf-unidad-envasada.entity';


@Module({
  imports: [
    TypeOrmModule.forFeature([
      Entrega,
      EntregaItem,
      Cliente,
      LoteProductoFinal,
      Deposito,
      PresentacionProductoFinal,
      // ✅ ESTO TE FALTABA (index [7] del error)
      StockMovimiento,

      // ✅ para Camino B
      StockPresentacion,
      PFUnidadEnvasada,
    ]),
    StockModule,
    AuditoriaModule,
  ],
  controllers: [EntregasController],
  providers: [EntregasService],
})
export class EntregasModule {}
