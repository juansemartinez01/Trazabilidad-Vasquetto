// src/modules/roles/dto/update-rol.dto.ts
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateRolDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nombre?: string;
}
