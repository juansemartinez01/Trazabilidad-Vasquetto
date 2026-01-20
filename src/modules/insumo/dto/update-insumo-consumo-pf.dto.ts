// src/modules/insumos/dto/update-insumo-consumo-pf.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateInsumoConsumoPfDto } from './create-insumo-consumo-pf.dto';

export class UpdateInsumoConsumoPfDto extends PartialType(
  CreateInsumoConsumoPfDto,
) {}
