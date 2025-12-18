// src/modules/roles/dto/create-rol.dto.ts
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateRolDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  nombre: string; // admin, produccion, etc.
}
