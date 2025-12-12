// src/modules/lotes/dto/cambiar-estado-lote-pf.dto.ts
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LotePfEstado } from '../entities/lote-producto-final.entity';

export class CambiarEstadoLotePfDto {
  @IsEnum(LotePfEstado)
  estado: LotePfEstado;

  @IsOptional()
  @IsString()
  motivoEstado?: string;
}
