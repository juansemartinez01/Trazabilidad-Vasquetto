import {
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';

export class BuscarAuditoriaDto {
  @IsOptional()
  @IsUUID()
  usuarioId?: string;

  @IsOptional()
  @IsString()
  accion?: string;

  @IsOptional()
  @IsString()
  search?: string; // texto libre en metadata

  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @IsOptional()
  @IsDateString()
  fechaHasta?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
