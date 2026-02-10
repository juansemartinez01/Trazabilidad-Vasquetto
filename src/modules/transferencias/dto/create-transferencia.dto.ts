import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  IsNumber,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransferenciaTipo } from '../entities/transferencia.entity';

export class CreateTransferenciaItemDto {
  // MP
  @IsOptional()
  @IsUUID()
  loteMpId?: string;

  // PF granel
  @IsOptional()
  @IsUUID()
  lotePfId?: string;

  // PF envasado
  @IsOptional()
  @IsUUID()
  presentacionId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  cantidadKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  cantidadUnidades?: number;

  @IsOptional()
  @IsString()
  descripcion?: string;

  // “campo dummy” para obligar a que venga ALGÚN target
  @ValidateIf((o) => !o.loteMpId && !o.lotePfId && !o.presentacionId)
  @IsUUID(undefined, {
    message: 'Debe venir loteMpId o lotePfId o presentacionId',
  })
  _dummyTarget?: string;
}

export class CreateTransferenciaDto {
  @IsDateString()
  fecha: string;

  @IsUUID()
  origenDepositoId: string;

  @IsUUID()
  destinoDepositoId: string;

  @IsEnum(TransferenciaTipo)
  tipo: TransferenciaTipo;

  @IsOptional()
  @IsUUID()
  responsableId?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransferenciaItemDto)
  items: CreateTransferenciaItemDto[];
}
