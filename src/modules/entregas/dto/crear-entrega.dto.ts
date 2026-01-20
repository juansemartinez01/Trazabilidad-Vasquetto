// dto/create-entrega.dto.ts
import {
  IsString,
  IsUUID,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CrearEntregaItemDto {
  @IsUUID()
  depositoId: string;

  @IsOptional()
  @IsUUID()
  presentacionId?: string;

  // ✅ FEFO granel: objetivo PF (si no mandás loteId)
  @IsOptional()
  @IsUUID()
  productoFinalId?: string;

  // ✅ modo manual (si querés permitirlo)
  @IsOptional()
  @IsUUID()
  loteId?: string;

  // granel (y presentacion KG)
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  cantidadKg?: number;

  // bulto/unidad (bolsas)
  @IsOptional()
  @IsNumber()
  @Min(1)
  cantidadBultos?: number;
}

export class CrearEntregaDto {
  @IsUUID()
  clienteId: string;

  @IsString()
  numeroRemito: string;

  @IsDateString()
  fecha: string;

  @IsUUID()
  choferId: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CrearEntregaItemDto)
  items: CrearEntregaItemDto[];
}
