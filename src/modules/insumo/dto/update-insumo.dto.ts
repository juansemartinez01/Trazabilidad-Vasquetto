import { PartialType } from '@nestjs/mapped-types';
import { CreateInsumoDto } from './create-insumo.dto';
import { IsOptional, IsNumber, Min } from 'class-validator';

export class UpdateInsumoDto extends PartialType(CreateInsumoDto) {
  // reafirmo validación numérica (por si querés permitir solo esto en update)
  @IsOptional()
  @IsNumber()
  @Min(0)
  stockMinimo?: number;
}
