import { IsInt, Min, IsOptional } from 'class-validator';

export class SetConfiguracionOperativaDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  diasProximoVencimiento?: number;
}
