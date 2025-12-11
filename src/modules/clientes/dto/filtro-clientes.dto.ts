import { IsOptional, IsString, IsNumberString } from 'class-validator';

export class FiltroClientesDto {
  @IsOptional()
  @IsString()
  search?: string; // busca en razón social, cuit, localidad

  @IsOptional()
  @IsString()
  localidad?: string;

  @IsOptional()
  @IsString()
  cuit?: string;

  @IsOptional()
  @IsNumberString()
  page?: number;

  @IsOptional()
  @IsNumberString()
  limit?: number;
}
