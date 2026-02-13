import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QueryInsumosDto {
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
  limit?: number = 50;

  // búsqueda (nombre/unidad)
  @IsOptional()
  @IsString()
  q?: string;

  // filtros exactos
  @IsOptional()
  @IsString()
  unidad?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  esEnvase?: boolean;

  // filtros por stock (útiles para alertas)
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  soloConStock?: boolean; // stockActual > 0

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  soloBajoMinimo?: boolean; // stockMinimo != null AND stockActual < stockMinimo

  // orden
  @IsOptional()
  @IsIn(['nombre', 'unidad', 'stockActual', 'stockMinimo', 'createdAt'])
  sortBy?: 'nombre' | 'unidad' | 'stockActual' | 'stockMinimo' | 'createdAt' =
    'nombre';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortDir?: 'ASC' | 'DESC' = 'ASC';
}
