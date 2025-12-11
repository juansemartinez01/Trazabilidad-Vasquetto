import { IsOptional, IsString, IsNumberString } from 'class-validator';

export class FiltroProveedoresDto {
  @IsOptional()
  @IsString()
  search?: string; // global: razón social, cuit, localidad

  @IsOptional()
  @IsString()
  cuit?: string;

  @IsOptional()
  @IsString()
  localidad?: string;

  @IsOptional()
  @IsNumberString()
  page?: number;

  @IsOptional()
  @IsNumberString()
  limit?: number;
}
