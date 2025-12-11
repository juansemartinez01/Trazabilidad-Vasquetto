import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MateriaPrima } from './entities/materia-prima.entity';
import { MateriaPrimaService } from './materia-prima.service';
import { MateriaPrimaController } from './materia-prima.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MateriaPrima])],
  controllers: [MateriaPrimaController],
  providers: [MateriaPrimaService],
  exports: [MateriaPrimaService],
})
export class MateriaPrimaModule {}
