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

export class QueryEmpaquesDto {
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

  @IsOptional()
  @IsIn(['fecha', 'createdAt', 'estado'])
  ordenCampo?: string = 'fecha';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  ordenDireccion?: 'ASC' | 'DESC' = 'DESC';

  @IsOptional()
  @IsString()
  estado?: 'BORRADOR' | 'CONFIRMADO' | 'ANULADO';

  @IsOptional()
  @IsUUID()
  lotePfId?: string;

  @IsOptional()
  @IsUUID()
  presentacionId?: string;

  @IsOptional()
  @IsUUID()
  depositoId?: string;

  @IsOptional()
  @IsISO8601()
  fechaDesde?: string;

  @IsOptional()
  @IsISO8601()
  fechaHasta?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
