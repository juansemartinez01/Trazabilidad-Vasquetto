import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoteMP } from '../lotes/entities/lote-mp.entity';
import { StockMovimiento } from './entities/stock-movimiento.entity';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { Deposito } from '../deposito/entities/deposito.entity';
import { LoteProductoFinal } from '../lotes/entities/lote-producto-final.entity';
import { StockMinimoMP } from '../configuracion/entities/stock-minimo-mp.entity';
import { StockMinimoPF } from '../configuracion/entities/stock-minimo-pf.entity';
import { MateriaPrima } from '../materia-prima/entities/materia-prima.entity';
import { ProductoFinal } from '../producto-final/entities/producto-final.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LoteMP, StockMovimiento, Deposito,LoteProductoFinal,

     // ✅ NUEVO
  StockMinimoMP,
  StockMinimoPF,
  MateriaPrima,
  ProductoFinal,
  ])],
  providers: [StockService],
  controllers: [StockController],
  exports: [StockService],
})
export class StockModule {}
