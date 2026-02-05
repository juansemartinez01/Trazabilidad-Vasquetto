import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QueryLotesMpDto {
  // 🔎 búsqueda libre por código de lote o nombre/código de la MP
  @IsOptional()
  @IsString()
  q?: string;

  // ✅ filtros directos
  @IsOptional()
  @IsUUID()
  depositoId?: string;

  @IsOptional()
  @IsUUID()
  materiaPrimaId?: string;

  // 🗓️ rangos de fechas (equivalente a "produccion" en PF)
  @IsOptional()
  @IsDateString()
  elaboracionDesde?: string; // YYYY-MM-DD

  @IsOptional()
  @IsDateString()
  elaboracionHasta?: string;

  @IsOptional()
  @IsDateString()
  vencimientoDesde?: string;

  @IsOptional()
  @IsDateString()
  vencimientoHasta?: string;

  // stock
  @IsOptional()
  @IsIn(['true', 'false'])
  conStock?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  sinStock?: string;

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
    'fechaElaboracion',
    'fechaVencimiento',
    'codigoLote',
    'cantidadActualKg',
    'createdAt',
  ])
  sort?: string = 'fechaVencimiento';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  dir?: 'ASC' | 'DESC' = 'ASC';
}
