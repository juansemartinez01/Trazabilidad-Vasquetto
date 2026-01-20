// src/modules/insumos/dto/calcular-consumo-insumos.dto.ts
import { IsOptional, IsUUID, IsNumber, Min, ValidateIf } from 'class-validator';

export class CalcularConsumoInsumosDto {
  @IsOptional()
  @IsUUID()
  productoFinalId?: string;

  @IsOptional()
  @IsUUID()
  presentacionId?: string;

  @ValidateIf((o) => !o.productoFinalId && !o.presentacionId)
  @IsUUID(undefined, { message: 'Debe venir productoFinalId o presentacionId' })
  _dummyTarget?: string;

  // si estás armando unidades (presentación)
  @IsOptional()
  @IsNumber()
  @Min(0)
  unidades?: number;

  // si estás produciendo por kg (para cantidadPorKg)
  @IsOptional()
  @IsNumber()
  @Min(0)
  kg?: number;
}
