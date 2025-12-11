import { IsString, MaxLength, IsOptional, IsObject } from 'class-validator';

export class CreateMateriaPrimaDto {
  @IsString()
  @MaxLength(200)
  nombre: string;

  @IsString()
  @MaxLength(100)
  unidadMedida: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsOptional()
  @IsObject()
  parametrosCalidadEsperados?: any;
}
