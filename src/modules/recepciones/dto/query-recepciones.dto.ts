import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class QueryRecepcionesDto {
  // Paginado
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
  limit?: number = 25;

  // Orden
  @IsOptional()
  @IsIn([
    'fechaRemito',
    'numeroRemito',
    'createdAt',
    'proveedorNombre',
    'transportista',
  ])
  ordenCampo?: string = 'fechaRemito';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  ordenDireccion?: 'ASC' | 'DESC' = 'DESC';

  // Flags de payload
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeLotes?: boolean = true;

  // Filtros Recepcion
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  numeroRemito?: string;

  @IsOptional()
  @IsISO8601()
  fechaRemitoDesde?: string;

  @IsOptional()
  @IsISO8601()
  fechaRemitoHasta?: string;

  @IsOptional()
  @IsString()
  transportista?: string;

  @IsOptional()
  @IsString()
  proveedorId?: string;

  @IsOptional()
  @IsString()
  proveedorNombre?: string;

  // Filtros por Lote / MP / Depósito
  @IsOptional()
  @IsString()
  codigoLote?: string;

  @IsOptional()
  @IsString()
  materiaPrimaId?: string;

  @IsOptional()
  @IsString()
  depositoId?: string;

  @IsOptional()
  @IsISO8601()
  fechaElaboracionDesde?: string;

  @IsOptional()
  @IsISO8601()
  fechaElaboracionHasta?: string;

  @IsOptional()
  @IsISO8601()
  fechaVencimientoDesde?: string;

  @IsOptional()
  @IsISO8601()
  fechaVencimientoHasta?: string;

  // Búsqueda libre (multi-campo)
  @IsOptional()
  @IsString()
  search?: string;
}
