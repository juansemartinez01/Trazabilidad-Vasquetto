import {
  IsOptional,
  IsString,
  MaxLength,
  IsArray,
  ValidateNested,
  IsUUID,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

class IngredienteActualizarRecetaDto {
  @IsUUID()
  materiaPrimaId: string;

  @IsNumber()
  @Min(0.01)
  @Max(100)
  porcentaje: number;
}

export class ActualizarRecetaDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngredienteActualizarRecetaDto)
  ingredientes: IngredienteActualizarRecetaDto[];
}
