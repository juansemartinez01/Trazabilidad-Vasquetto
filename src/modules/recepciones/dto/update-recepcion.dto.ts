import {
  IsUUID,
  IsString,
  IsOptional,
  IsDateString,
  MaxLength,
  IsObject,
} from 'class-validator';

export class UpdateRecepcionDto {
  @IsOptional()
  @IsUUID()
  proveedorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  numeroRemito?: string;

  @IsOptional()
  @IsDateString()
  fechaRemito?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  transportista?: string;

  @IsOptional()
  @IsObject()
  documentos?: any; // remito PDF u otros adjuntos

  // ✅ NUEVO: texto largo opcional
  @IsOptional()
  @IsString()
  detalleLotesDefectuosos?: string;
}
