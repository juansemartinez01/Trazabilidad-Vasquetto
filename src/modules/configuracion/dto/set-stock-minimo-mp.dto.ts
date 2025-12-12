import { IsUUID, IsNumber, Min } from 'class-validator';

export class SetStockMinimoMpDto {
  @IsUUID()
  materiaPrimaId: string;

  @IsNumber()
  @Min(0)
  stockMinKg: number;
}
