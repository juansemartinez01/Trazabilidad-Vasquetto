import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Insumo } from './entities/insumo.entity';
import { InsumoService } from './insumo.service';
import { InsumoController } from './insumo.controller';
import { InsumoMovimiento } from './entities/insumo-movimiento.entity';
import { InsumoConsumoPfService } from './insumo-consumo-pf.service';
import { InsumoConsumoPfController } from './insumo-consumo-pf.controller';
import { PresentacionProductoFinal } from '../producto-final/entities/presentacion-producto-final.entity';
import { ProductoFinal } from '../producto-final/entities/producto-final.entity';

import { InsumoConsumoPF } from './entities/insumo-consumo-pf.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Insumo,
      InsumoMovimiento,
      InsumoConsumoPF,
      ProductoFinal,
      PresentacionProductoFinal,
    ]),
  ],
  controllers: [InsumoController, InsumoConsumoPfController],
  providers: [InsumoService, InsumoConsumoPfService],
  exports: [InsumoService, InsumoConsumoPfService],
})
export class InsumoModule {}
