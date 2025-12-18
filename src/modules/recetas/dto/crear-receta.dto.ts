import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUUID,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

class IngredienteRecetaDto {
  @IsUUID()
  materiaPrimaId: string;

  @IsNumber()
  @Min(0.01)
  @Max(100)
  porcentaje: number;
}

export class CrearRecetaDto {
  @IsString()
  @MaxLength(200)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngredienteRecetaDto)
  ingredientes: IngredienteRecetaDto[];

  @IsUUID()
  productoFinalId: string;
}
