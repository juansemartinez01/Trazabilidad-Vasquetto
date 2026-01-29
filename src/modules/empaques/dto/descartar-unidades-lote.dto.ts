import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export enum EstadoDestinoUnidad {
  ANULADO = 'ANULADO',
  MERMA = 'MERMA',
}

export class DescartarUnidadesLoteDto {
  @IsUUID()
  loteId: string;

  // recomendado: obligar presentacion/depósito para no “romper” múltiples grupos
  @IsUUID()
  presentacionId: string;

  @IsUUID()
  depositoId: string;

  @IsInt()
  @Min(1)
  cantidad: number;

  @IsEnum(EstadoDestinoUnidad)
  estadoDestino: EstadoDestinoUnidad;

  @IsOptional()
  @IsString()
  motivo?: string;
}
