import { IsNumber, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddEmpaqueItemDto {
  @IsUUID()
  presentacionId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  cantidadKg: number;
}
