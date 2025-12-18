import { IsString, IsOptional, IsEmail, MaxLength, IsArray, IsUUID } from 'class-validator';

export class CreateProveedorDto {
  @IsString()
  @MaxLength(200)
  razonSocial: string;

  @IsOptional()
  @IsString()
  cuit?: string;

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

  // ✅ nuevos
  @IsOptional()
  @IsString()
  @MaxLength(50)
  numeroRenspa?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  numeroInscripcionSenasa?: string;

  // ✅ asignación de materias primas
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  materiaPrimaIds?: string[];
}
