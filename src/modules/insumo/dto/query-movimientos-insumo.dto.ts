import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { TipoMovimientoInsumo } from '../entities/insumo-movimiento.entity';

export class QueryMovimientosInsumoDto {
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

  // filtros
  @IsOptional()
  @IsEnum(TipoMovimientoInsumo)
  tipo?: TipoMovimientoInsumo;

  @IsOptional()
  @IsDateString()
  desde?: string; // ISO

  @IsOptional()
  @IsDateString()
  hasta?: string; // ISO

  // filtrar por insumo puntual (opcional; útil para reutilizar)
  @IsOptional()
  @IsUUID()
  insumoId?: string;

  // búsqueda por nombre de insumo
  @IsOptional()
  @IsString()
  q?: string;

  // filtrar por referencia / responsable
  @IsOptional()
  @IsString()
  referenciaId?: string;

  @IsOptional()
  @IsString()
  responsableId?: string;

  // ordenar
  @IsOptional()
  @IsString()
  order?: 'ASC' | 'DESC' = 'DESC';
}
