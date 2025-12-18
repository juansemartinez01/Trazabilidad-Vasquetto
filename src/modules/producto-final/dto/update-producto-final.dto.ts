// src/modules/producto-final/dto/update-producto-final.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateProductoFinalDto } from './create-producto-final.dto';

export class UpdateProductoFinalDto extends PartialType(
  CreateProductoFinalDto,
) {}
