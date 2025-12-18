import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Proveedor } from './entities/proveedor.entity';
import { ProveedoresService } from './proveedores.service';
import { ProveedoresController } from './proveedores.controller';
import { ProveedorMateriaPrima } from './entities/proveedor-materia-prima.entity';
import { MateriaPrima } from '../materia-prima/entities/materia-prima.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Proveedor, ProveedorMateriaPrima, MateriaPrima]),
  ],
  providers: [ProveedoresService],
  controllers: [ProveedoresController],
  exports: [ProveedoresService],
})
export class ProveedoresModule {}
