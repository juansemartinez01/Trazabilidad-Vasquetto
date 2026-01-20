import { IsUUID, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class SetStockMinimoPfDto {
  @IsUUID()
  productoFinalId: string;

  @Type(() => Number)
  @IsNumber()
  stockMinKg: number;
}
