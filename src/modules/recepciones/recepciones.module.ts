import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Recepcion } from './entities/recepcion.entity';
import { LoteMP } from '../lotes/entities/lote-mp.entity';
import { MateriaPrima } from '../materia-prima/entities/materia-prima.entity';
import { Deposito } from '../deposito/entities/deposito.entity';
import { RecepcionesService } from './recepciones.service';
import { RecepcionesController } from './recepciones.controller';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { Proveedor } from '../proveedores/entities/proveedor.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Recepcion, LoteMP, MateriaPrima, Deposito,Proveedor]),
    AuditoriaModule,
  ],
  providers: [RecepcionesService],
  controllers: [RecepcionesController],
})
export class RecepcionesModule {}
