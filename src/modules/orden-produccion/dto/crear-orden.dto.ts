import {
  IsString,
  IsUUID,
  IsNumber,
  Min,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class CrearOrdenProduccionDto {
  @IsUUID()
  recetaId: string;

  @IsNumber()
  @Min(1)
  cantidadKg: number;

  @IsUUID()
  responsableId: string;

  @IsUUID()
  depositoDestinoId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
