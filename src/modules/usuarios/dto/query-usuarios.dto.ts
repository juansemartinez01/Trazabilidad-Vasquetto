// src/modules/usuarios/dto/query-usuarios.dto.ts
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryUsuariosDto {
  @IsOptional()
  @IsString()
  q?: string; // busca por nombre/email

  // Filtrar por rol (por nombre del rol)
  // Ej: rol=PRODUCCION
  @IsOptional()
  @IsString()
  rol?: string;

  // Opcional: múltiples roles por coma: roles=PRODUCCION,ADMIN
  @IsOptional()
  @IsString()
  roles?: string;

  // paginado
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
  limit?: number = 20;

  // ordenamiento (whitelist)
  @IsOptional()
  @IsIn(['createdAt', 'nombre', 'email'])
  sortBy?: 'createdAt' | 'nombre' | 'email' = 'createdAt';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortDir?: 'ASC' | 'DESC' = 'DESC';

  // opcional
  @IsOptional()
  @IsIn(['true', 'false'])
  all?: string;
}
