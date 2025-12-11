import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Receta } from './entities/receta.entity';
import { RecetaVersion } from './entities/receta-version.entity';
import { RecetaIngrediente } from './entities/receta-ingrediente.entity';
import { RecetasService } from './recetas.service';
import { RecetasController } from './recetas.controller';
import { MateriaPrima } from '../materia-prima/entities/materia-prima.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Receta,
      RecetaVersion,
      RecetaIngrediente,
      MateriaPrima,
    ]),
    AuditoriaModule,
  ],
  controllers: [RecetasController],
  providers: [RecetasService],
  exports: [RecetasService],
})
export class RecetasModule {}
