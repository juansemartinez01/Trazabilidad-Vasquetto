import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deposito } from './entities/deposito.entity';
import { DepositoService } from './deposito.service';
import { DepositoController } from './deposito.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Deposito])],
  controllers: [DepositoController],
  providers: [DepositoService],
})
export class DepositoModule {}
