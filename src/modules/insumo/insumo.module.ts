import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Insumo } from './entities/insumo.entity';
import { InsumoService } from './insumo.service';
import { InsumoController } from './insumo.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Insumo])],
  controllers: [InsumoController],
  providers: [InsumoService],
})
export class InsumoModule {}
