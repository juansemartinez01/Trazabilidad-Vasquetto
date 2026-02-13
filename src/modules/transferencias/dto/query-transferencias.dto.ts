import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  TransferenciaEstado,
  TransferenciaTipo,
} from '../entities/transferencia.entity';

export class QueryTransferenciasDto {
  // paginado
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  // rango por fecha (columna "fecha" de transferencia)
  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;

  // filtros directos
  @IsOptional()
  @IsEnum(TransferenciaTipo)
  tipo?: TransferenciaTipo;

  @IsOptional()
  @IsEnum(TransferenciaEstado)
  estado?: TransferenciaEstado;

  @IsOptional()
  @IsUUID()
  origenDepositoId?: string;

  @IsOptional()
  @IsUUID()
  destinoDepositoId?: string;

  @IsOptional()
  @IsUUID()
  responsableId?: string;

  // buscar por texto (observaciones / descripcion item / codigo de lotes)
  @IsOptional()
  @IsString()
  q?: string;

  // filtros por contenido de items
  @IsOptional()
  @IsUUID()
  loteMpId?: string;

  @IsOptional()
  @IsUUID()
  lotePfId?: string;

  @IsOptional()
  @IsUUID()
  lotePfOrigenId?: string;

  @IsOptional()
  @IsUUID()
  presentacionId?: string;

  // ordenar
  @IsOptional()
  @IsIn(['fecha', 'createdAt'])
  sortBy?: 'fecha' | 'createdAt' = 'createdAt';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortDir?: 'ASC' | 'DESC' = 'DESC';
}
