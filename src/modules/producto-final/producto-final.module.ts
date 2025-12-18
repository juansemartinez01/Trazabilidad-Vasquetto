// src/modules/producto-final/producto-final.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductoFinal } from './entities/producto-final.entity';
import { PresentacionProductoFinal } from './entities/presentacion-producto-final.entity';
import { ProductoFinalService } from './producto-final.service';
import { ProductoFinalController } from './producto-final.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductoFinal, PresentacionProductoFinal]),
  ],
  controllers: [ProductoFinalController],
  providers: [ProductoFinalService],
  exports: [TypeOrmModule, ProductoFinalService], // por si receta/producción lo usa
})
export class ProductoFinalModule {}
