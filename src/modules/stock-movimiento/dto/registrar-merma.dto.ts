import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class RegistrarMermaDto {
  @IsNumber()
  @Min(0.0001)
  cantidadKg: number;

  @IsString()
  motivo: string;

  @IsOptional()
  @IsUUID()
  responsableId?: string;

  // Evidencia simple (podés cambiar a JSON más estricto después)
  @IsOptional()
  evidencia?: any;
}
