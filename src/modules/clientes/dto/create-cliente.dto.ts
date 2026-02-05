import { IsString, IsOptional, IsEmail, MaxLength } from 'class-validator';

export class CreateClienteDto {
  @IsString()
  @MaxLength(200)
  razonSocial: string;

  // ✅ ID fiscal genérico
  @IsOptional()
  @IsString()
  @MaxLength(60)
  cuit?: string;

  // ✅ NUEVO
  @IsOptional()
  @IsString()
  @MaxLength(80)
  pais?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsString()
  localidad?: string;

  @IsOptional()
  @IsString()
  provincia?: string;

  @IsOptional()
  @IsString()
  contacto?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
