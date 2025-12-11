import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Cliente } from './entities/cliente.entity';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Cliente])],
  providers: [ClientesService],
  controllers: [ClientesController],
  exports: [ClientesService],
})
export class ClientesModule {}
