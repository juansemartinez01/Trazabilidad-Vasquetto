import {
  IsUUID,
  IsString,
  MaxLength,
  IsDateString,
  IsOptional,
  IsNumber,
  Min,
  IsObject,
} from 'class-validator';

export class CrearLoteRecepcionDto {
  @IsUUID()
  materiaPrimaId: string;

  @IsUUID()
  depositoId: string;

  @IsString()
  @MaxLength(100)
  codigoLote: string;

  @IsDateString()
  fechaElaboracion: string;

  @IsOptional()
  @IsDateString()
  fechaAnalisis?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  mesesVencimiento?: number;

  // ✅ NUEVO: fecha exacta de vencimiento (si existe en remito/etiqueta)
  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;

  @IsNumber()
  @Min(0.1)
  cantidadKg: number;

  @IsOptional()
  @IsObject()
  analisis?: any;

  @IsOptional()
  @IsObject()
  documentos?: any;
}
