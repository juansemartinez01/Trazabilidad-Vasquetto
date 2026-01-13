import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Insumo } from './entities/insumo.entity';
import { InsumoService } from './insumo.service';
import { InsumoController } from './insumo.controller';
import { InsumoMovimiento } from './entities/insumo-movimiento.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Insumo,InsumoMovimiento])],
  controllers: [InsumoController],
  providers: [InsumoService],
})
export class InsumoModule {}
