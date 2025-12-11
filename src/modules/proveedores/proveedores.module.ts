import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Proveedor } from './entities/proveedor.entity';
import { ProveedoresService } from './proveedores.service';
import { ProveedoresController } from './proveedores.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Proveedor])],
  providers: [ProveedoresService],
  controllers: [ProveedoresController],
  exports: [ProveedoresService],
})
export class ProveedoresModule {}
