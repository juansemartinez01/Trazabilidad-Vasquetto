// src/modules/entregas/dto/query-entregas.dto.ts
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class QueryEntregasDto {
  // búsqueda libre (nro remito, observaciones, y opcionalmente campos de cliente)
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsOptional()
  @IsUUID()
  choferId?: string;

  // rango de fechas (sobre e.fecha)
  @IsOptional()
  @IsISO8601()
  desde?: string; // YYYY-MM-DD o ISO

  @IsOptional()
  @IsISO8601()
  hasta?: string;

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
  @Max(100)
  limit?: number = 20;

  // ordenamiento (whitelist)
  @IsOptional()
  @IsIn(['fecha', 'createdAt', 'numeroRemito', 'cliente', 'chofer'])
  sortBy?: 'fecha' | 'createdAt' | 'numeroRemito' | 'cliente' | 'chofer' =
    'createdAt';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortDir?: 'ASC' | 'DESC' = 'DESC';

  // opcional: para traer TODO sin paginar (solo si realmente lo necesitás)
  @IsOptional()
  @IsIn(['true', 'false'])
  all?: string; // 'true' | 'false'
}
