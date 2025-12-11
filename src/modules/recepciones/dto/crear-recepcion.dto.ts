import {
  IsUUID,
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  MaxLength,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CrearLoteRecepcionDto } from './crear-lote-recepcion.dto';

export class CrearRecepcionDto {
  @IsUUID()
  proveedorId: string;

  @IsString()
  @MaxLength(100)
  numeroRemito: string;

  @IsDateString()
  fechaRemito: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  transportista?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CrearLoteRecepcionDto)
  lotes: CrearLoteRecepcionDto[];

  @IsOptional()
  @IsObject()
  documentos?: any; // remito PDF u otros adjuntos
}
