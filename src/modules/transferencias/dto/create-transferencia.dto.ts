import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransferenciaTipo } from '../entities/transferencia.entity';

export class CreateTransferenciaItemDto {
  @IsOptional()
  @IsUUID()
  loteMpId?: string;

  @IsOptional()
  @IsUUID()
  lotePfId?: string;

  @IsOptional()
  @IsUUID()
  presentacionId?: string;

  @IsOptional()
  cantidadKg?: number;

  @IsOptional()
  cantidadUnidades?: number;

  @IsOptional()
  @IsString()
  descripcion?: string;
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
