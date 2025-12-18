import { Module, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeormConfig } from './config/typeorm.config';
import { TenantMiddleware } from './common/middlewares/tenant.middleware';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantInterceptor } from './common/interceptors/tenant-interceptor';
import { UsuarioMiddleware } from './modules/auth/middlewares/usuario.middleware';

import { AuthModule } from './modules/auth/auth.module';

import { MateriaPrimaModule } from './modules/materia-prima/materia-prima.module';
import { InsumoModule } from './modules/insumo/insumo.module';
import { DepositoModule } from './modules/deposito/deposito.module';
import { RecepcionesModule } from './modules/recepciones/recepciones.module';
import { StockModule } from './modules/stock-movimiento/stock.module';
import { RecetasModule } from './modules/recetas/recetas.module';
import { OrdenesProduccionModule } from './modules/orden-produccion/ordenes-produccion.module';
import { EntregasModule } from './modules/entregas/entregas.module';
import { TrazabilidadModule } from './modules/trazabilidad/trazabilidad.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { ProveedoresModule } from './modules/proveedores/proveedores.module';

import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { LotesModule } from './modules/lotes/lotes.module';
import { MetricasModule } from './modules/metricas/metricas.module';
import { ConfiguracionModule } from './modules/configuracion/configuracion.module';
import { ProductoFinalModule } from './modules/producto-final/producto-final.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { RolesModule } from './modules/roles/roles.module';


@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => typeormConfig,
    }),
    AuthModule,
    AuditoriaModule,
    MateriaPrimaModule,
    InsumoModule,
    DepositoModule,
    RecepcionesModule,
    StockModule,
    RecetasModule,
    OrdenesProduccionModule,
    EntregasModule,
    TrazabilidadModule,
    ClientesModule,
    ProveedoresModule,
    LotesModule,
    MetricasModule,
    ConfiguracionModule,
    ProductoFinalModule,
    UsuariosModule,
    RolesModule
    // acá vamos a ir agregando módulos
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
    consumer.apply(UsuarioMiddleware).forRoutes('*');
  }
}
