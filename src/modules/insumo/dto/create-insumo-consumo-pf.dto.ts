// src/modules/insumos/dto/create-insumo-consumo-pf.dto.ts
import {
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  ValidateIf,
  IsBoolean,
} from 'class-validator';

export class CreateInsumoConsumoPfDto {
  @IsUUID()
  insumoId: string;

  @IsOptional()
  @IsUUID()
  productoFinalId?: string;

  @IsOptional()
  @IsUUID()
  presentacionId?: string;

  // ✅ exige al menos uno
  @ValidateIf((o) => !o.productoFinalId && !o.presentacionId)
  @IsUUID(undefined, { message: 'Debe venir productoFinalId o presentacionId' })
  _dummyTarget?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cantidadPorUnidad?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cantidadPorKg?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsBoolean()
  esEnvase?: boolean;
}
