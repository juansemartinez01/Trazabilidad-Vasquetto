// src/modules/transferencias/transferencias.module.ts

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TransferenciasController } from './transferencias.controller';
import { TransferenciasService } from './transferencias.service';

// Entidades propias
import { Transferencia } from './entities/transferencia.entity';
import { TransferenciaItem } from './entities/transferencia-item.entity';
import { TransferenciaUnidad } from './entities/transferencia-unidad.entity'; // ✅ AGREGAR

// Entidades relacionadas
import { Deposito } from '../deposito/entities/deposito.entity';
import { LoteMP } from '../lotes/entities/lote-mp.entity';
import { LoteProductoFinal } from '../lotes/entities/lote-producto-final.entity';
import { StockMovimiento } from '../stock-movimiento/entities/stock-movimiento.entity';

// Presentación / unidades
import { PresentacionProductoFinal } from '../producto-final/entities/presentacion-producto-final.entity';
import { StockPresentacion } from '../empaques/entities/stock-presentacion.entity';
import { PFUnidadEnvasada } from '../empaques/entities/pf-unidad-envasada.entity';

// Auditoría (si aplica)
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transferencia,
      TransferenciaItem,
      TransferenciaUnidad, // ✅ CLAVE

      Deposito,
      LoteMP,
      LoteProductoFinal,
      PresentacionProductoFinal,
      PFUnidadEnvasada,
      StockPresentacion,
      StockMovimiento,
    ]),
    forwardRef(() => AuditoriaModule),
  ],
  controllers: [TransferenciasController],
  providers: [TransferenciasService],
  exports: [TransferenciasService],
})
export class TransferenciasModule {}
