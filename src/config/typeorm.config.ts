import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { config } from 'dotenv';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

config(); // carga .env

export const typeormConfig: TypeOrmModuleOptions = {
  type: 'postgres',

  /**
   * 🔌 Conexión
   * DATABASE_URL tiene prioridad si existe
   */
  url: process.env.DATABASE_URL ?? undefined,

  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  /**
   * 🟦 ENTIDADES
   * autoLoadEntities permite que Nest cargue automáticamente
   * todas las entidades registradas en módulos.
   */
  autoLoadEntities: true,

  /**
   * No usar synchronize en producción.
   * En desarrollo lo podemos activar, pero lo correcto es:
   */
  synchronize: true,

  /**
   * 📦 Migraciones
   */
  migrationsRun: false,
  migrations: ['dist/migrations/*.js'],
  migrationsTableName: 'migrations',

  /**
   * 🧵 Naming Strategy — snake_case
   */
  namingStrategy: new SnakeNamingStrategy(),

  /**
   * 🟣 Logging
   */
  logging: process.env.ENABLE_QUERY_LOGGING === 'true',
  maxQueryExecutionTime: process.env.SLOW_QUERY_THRESHOLD_MS
    ? Number(process.env.SLOW_QUERY_THRESHOLD_MS)
    : 1000,

  /**
   * ⏱ Zona horaria
   * (No soportado directamente por TypeORM, eliminar para evitar error)
   */
  // timezone: process.env.TIMEZONE ?? 'UTC',

  /**
   * Importante para Pg >= 15
   */
  extra: {
    max: 20, // pool de conexiones
  },
};
