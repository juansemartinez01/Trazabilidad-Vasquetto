import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class MovimientoStockDto {
  @IsNumber()
  @Min(0.000001)
  cantidad: number;

  @IsOptional()
  @IsString()
  motivo?: string;

  @IsOptional()
  @IsString()
  referenciaId?: string;

  @IsOptional()
  @IsString()
  responsableId?: string;
}

// Ajuste permite + o -
export class AjusteStockDto {
  @IsNumber()
  cantidadAjuste: number;

  @IsString()
  motivo: string;

  @IsOptional()
  @IsString()
  referenciaId?: string;

  @IsOptional()
  @IsString()
  responsableId?: string;
}
