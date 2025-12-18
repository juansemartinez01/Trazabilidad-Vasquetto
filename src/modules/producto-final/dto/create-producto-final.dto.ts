// src/modules/producto-final/dto/create-producto-final.dto.ts
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  IsArray,
  ValidateNested,
  IsEnum,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UnidadVenta } from '../entities/presentacion-producto-final.entity';

export class CreatePresentacionDto {
  @IsString()
  codigo: string;

  @IsString()
  nombre: string;

  @IsEnum(UnidadVenta)
  unidadVenta: UnidadVenta;

  @IsOptional()
  @IsNumber()
  pesoPorUnidadKg?: number;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}

export class CreateProductoFinalDto {
  @IsString()
  nombre: string;

  @IsString()
  codigo: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  especificaciones?: any;

  @IsOptional()
  @IsInt()
  @Min(1)
  vidaUtilDias?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePresentacionDto)
  presentaciones?: CreatePresentacionDto[];
}
