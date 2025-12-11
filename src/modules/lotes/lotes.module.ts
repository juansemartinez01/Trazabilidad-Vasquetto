import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoteMP } from './entities/lote-mp.entity';
import { LoteProductoFinal } from './entities/lote-producto-final.entity';
import { LotesController } from './lotes.controller';
import { LotesService } from './lotes.service';

@Module({
  imports: [TypeOrmModule.forFeature([LoteMP, LoteProductoFinal])],
  controllers: [LotesController],
  providers: [LotesService],
  exports: [LotesService],
})
export class LotesModule {}
