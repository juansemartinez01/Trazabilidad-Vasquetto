import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LotePfEstado } from '../entities/lote-producto-final.entity';

export class QueryLotesPfDto {
  // 🔎 búsqueda libre por código de lote o nombre/código del PF
  @IsOptional()
  @IsString()
  q?: string;

  // ✅ filtros directos
  @IsOptional()
  @IsEnum(LotePfEstado)
  estado?: LotePfEstado;

  @IsOptional()
  @IsUUID()
  depositoId?: string;

  @IsOptional()
  @IsUUID()
  productoFinalId?: string;

  // 🗓️ rangos de fechas
  @IsOptional()
  @IsDateString()
  produccionDesde?: string; // YYYY-MM-DD

  @IsOptional()
  @IsDateString()
  produccionHasta?: string;

  @IsOptional()
  @IsDateString()
  vencimientoDesde?: string;

  @IsOptional()
  @IsDateString()
  vencimientoHasta?: string;

  // stock
  @IsOptional()
  @IsIn(['true', 'false'])
  conStock?: string; // true => cantidadActualKg > 0

  @IsOptional()
  @IsIn(['true', 'false'])
  sinStock?: string; // true => cantidadActualKg <= 0

  // paginado
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 30;

  // sorting controlado (whitelist)
  @IsOptional()
  @IsIn([
    'fechaProduccion',
    'fechaVencimiento',
    'codigoLote',
    'estado',
    'cantidadActualKg',
    'createdAt',
  ])
  sort?: string = 'fechaProduccion';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  dir?: 'ASC' | 'DESC' = 'DESC';
}
