// src/modules/stock/dto/query-movimientos.dto.ts
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
import { Type } from 'class-transformer';
import { TipoMovimiento } from '../entities/stock-movimiento.entity';

export class QueryMovimientosDto {
  @IsOptional()
  @IsEnum(TipoMovimiento)
  tipo?: TipoMovimiento;

  // múltiples tipos por coma: MERMA_PF,AJUSTE,ENTREGA
  @IsOptional()
  @IsString()
  tipos?: string;

  @IsOptional()
  @IsUUID()
  depositoId?: string;

  @IsOptional()
  @IsUUID()
  loteMpId?: string;

  @IsOptional()
  @IsUUID()
  lotePfId?: string;

  @IsOptional()
  @IsUUID()
  presentacionId?: string;

  @IsOptional()
  @IsUUID()
  unidadEnvasadaId?: string;

  // filtro por referencia externa (orden/recepción/etc.)
  @IsOptional()
  @IsString()
  referenciaId?: string;

  // búsqueda simple (motivo o referencia)
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsDateString()
  desde?: string; // createdAt >=

  @IsOptional()
  @IsDateString()
  hasta?: string; // createdAt <=

  // paginación
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

  // orden
  @IsOptional()
  @IsEnum(['ASC', 'DESC'] as any)
  order?: 'ASC' | 'DESC' = 'DESC';
}
