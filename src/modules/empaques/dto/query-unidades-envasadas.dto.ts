// src/modules/empaques/dto/query-unidades-envasadas.dto.ts
import { IsOptional, IsUUID, IsIn, IsInt, Min, IsBooleanString } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryUnidadesEnvasadasDto {
  @IsOptional()
  @IsUUID()
  loteId?: string;

  @IsOptional()
  @IsUUID()
  presentacionId?: string;

  @IsOptional()
  @IsUUID()
  depositoId?: string;

  @IsOptional()
  @IsIn(['DISPONIBLE', 'ENTREGADO', 'ANULADO', 'MERMA'])
  estado?: 'DISPONIBLE' | 'ENTREGADO' | 'ANULADO' | 'MERMA';

  // ✅ NUEVO: filtrar grupos con disponibles > 0
  // (viene como string 'true'/'false' en querystring)
  @IsOptional()
  @IsBooleanString()
  soloDisponibles?: string; // 'true' | 'false'

  // ✅ NUEVO: traer o no el detalle de unidades (etiquetas)
  @IsOptional()
  @IsBooleanString()
  traerDetalle?: string; // 'true' | 'false'

  // paginado de unidades por grupo (para no traer 50k etiquetas)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unidadesLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  unidadesOffset?: number;
}
