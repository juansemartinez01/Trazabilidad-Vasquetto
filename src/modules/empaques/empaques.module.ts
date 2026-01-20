import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmpaquesService } from './empaques.service';
import { EmpaquesController } from './empaques.controller';
import { EmpaquesStockController } from './empaques-stock.controller';
import { Empaque } from './entities/empaque.entity';
import { EmpaqueItem } from './entities/empaque-item.entity';
import { StockPresentacion } from './entities/stock-presentacion.entity';
import { PFUnidadEnvasada } from './entities/pf-unidad-envasada.entity';
import { LoteProductoFinal } from '../lotes/entities/lote-producto-final.entity';
import { Deposito } from '../deposito/entities/deposito.entity';
import { PresentacionProductoFinal } from '../producto-final/entities/presentacion-producto-final.entity';
import { StockMovimiento } from '../stock-movimiento/entities/stock-movimiento.entity';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { InsumoModule } from '../insumo/insumo.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Empaque,
      EmpaqueItem,
      StockPresentacion,
      PFUnidadEnvasada,
      LoteProductoFinal,
      Deposito,
      PresentacionProductoFinal,
      StockMovimiento,
    ]),
    AuditoriaModule,
    InsumoModule,
  ],
  providers: [EmpaquesService],
  controllers: [EmpaquesController, EmpaquesStockController],
})
export class EmpaquesModule {}
