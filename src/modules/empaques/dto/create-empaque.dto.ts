import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateEmpaqueDto {
  @IsUUID()
  lotePfId: string;

  @IsUUID()
  depositoId: string;

  @IsUUID()
  responsableId: string;

  @IsDateString()
  fecha: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
