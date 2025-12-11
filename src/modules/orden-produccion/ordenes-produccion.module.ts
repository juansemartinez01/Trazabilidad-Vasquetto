import { TypeOrmModule } from "@nestjs/typeorm";
import { OrdenProduccion } from "./entities/orden-produccion.entity";
import { OrdenIngrediente } from "./entities/orden-ingrediente.entity";
import { OrdenConsumo } from "./entities/orden-consumo.entity";
import { LoteProductoFinal } from "../lotes/entities/lote-producto-final.entity";
import { Receta } from "../recetas/entities/receta.entity";
import { Deposito } from "../deposito/entities/deposito.entity";
import { OrdenesProduccionController } from "./ordenes-produccion.controller";
import { OrdenesProduccionService } from "./ordenes-produccion.service";
import { StockService } from "../stock-movimiento/stock.service";
import { AuditoriaService } from "../auditoria/auditoria.service";
import { Module } from '@nestjs/common';
import { AuditoriaModule } from "../auditoria/auditoria.module";
import { StockModule } from "../stock-movimiento/stock.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrdenProduccion,
      OrdenIngrediente,
      OrdenConsumo,
      LoteProductoFinal,
      Receta,
      Deposito,
    ]),
    StockModule,
    AuditoriaModule,
  ],
  controllers: [OrdenesProduccionController],
  providers: [OrdenesProduccionService],
})
export class OrdenesProduccionModule {}
