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
  loteId: string;

  @IsUUID()
  depositoId: string;

  @IsNumber()
  @Min(0.1)
  cantidadKg: number;

  @IsNumber()
  @Min(1)
  cantidadBultos: number;
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
