// src/modules/stock/dto/query-resumen-pf.dto.ts
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LotePfEstado } from '../../lotes/entities/lote-producto-final.entity';

export class QueryResumenPfDto {
  // un estado
  @IsOptional()
  @IsEnum(LotePfEstado)
  estado?: LotePfEstado;

  // múltiples estados por coma: LISTO,RETENIDO
  @IsOptional()
  @IsString()
  estados?: string;
}
