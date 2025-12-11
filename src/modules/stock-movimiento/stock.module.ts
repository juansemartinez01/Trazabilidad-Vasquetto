import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoteMP } from '../lotes/entities/lote-mp.entity';
import { StockMovimiento } from './entities/stock-movimiento.entity';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { Deposito } from '../deposito/entities/deposito.entity';
import { LoteProductoFinal } from '../lotes/entities/lote-producto-final.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LoteMP, StockMovimiento, Deposito,LoteProductoFinal])],
  providers: [StockService],
  controllers: [StockController],
  exports: [StockService],
})
export class StockModule {}
