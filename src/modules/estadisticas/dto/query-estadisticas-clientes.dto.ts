import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QueryEstadisticasClientesDto {
  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;

  @IsOptional()
  @IsIn(['month', 'year'])
  periodo?: 'month' | 'year' = 'month';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  top?: number = 10;

  @IsOptional()
  @IsIn(['true', 'false'])
  incluirOtros?: string = 'true';

  @IsOptional()
  @IsUUID()
  clienteId?: string;

  // ✅ NUEVO: filtrar comparaciones por PF (coherente)
  @IsOptional()
  @IsUUID()
  productoFinalId?: string;

  // ✅ opcional: si querés comparar por presentación específica
  @IsOptional()
  @IsUUID()
  presentacionId?: string;
}
