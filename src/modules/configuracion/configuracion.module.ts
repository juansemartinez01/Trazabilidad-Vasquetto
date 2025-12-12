import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfiguracionController } from './configuracion.controller';
import { ConfiguracionService } from './configuracion.service';

import { ConfiguracionOperativa } from './entities/configuracion-operativa.entity';
import { StockMinimoMP } from './entities/stock-minimo-mp.entity';

import { MateriaPrima } from '../materia-prima/entities/materia-prima.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConfiguracionOperativa,
      StockMinimoMP,
      MateriaPrima,
    ]),
  ],
  controllers: [ConfiguracionController],
  providers: [ConfiguracionService],
  exports: [ConfiguracionService],
})
export class ConfiguracionModule {}
