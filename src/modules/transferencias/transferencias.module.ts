// src/modules/transferencias/transferencias.module.ts

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TransferenciasController } from './transferencias.controller';
import { TransferenciasService } from './transferencias.service';

// Entidades propias
import { Transferencia } from './entities/transferencia.entity';
import { TransferenciaItem } from './entities/transferencia-item.entity';

// Entidades relacionadas
import { Deposito } from '../deposito/entities/deposito.entity';
import { LoteMP } from '../lotes/entities/lote-mp.entity';
import { LoteProductoFinal } from '../lotes/entities/lote-producto-final.entity';
import { StockMovimiento } from '../stock-movimiento/entities/stock-movimiento.entity';

// Envasado / presentaciones
import { StockPresentacion } from '../empaques/entities/stock-presentacion.entity';
import { PFUnidadEnvasada } from '../empaques/entities/pf-unidad-envasada.entity';

// Si tu TransferenciasService registra auditoría:
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transferencia,
      TransferenciaItem,

      Deposito,
      LoteMP,
      LoteProductoFinal,
      StockMovimiento,

      StockPresentacion,
      PFUnidadEnvasada,
    ]),

    // ✅ Si AuditoriaService vive en AuditoriaModule y este exporta el service:
    forwardRef(() => AuditoriaModule),
  ],
  controllers: [TransferenciasController],
  providers: [TransferenciasService],
  exports: [TransferenciasService],
})
export class TransferenciasModule {}
