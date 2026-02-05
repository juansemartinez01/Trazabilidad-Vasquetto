import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

export class QueryEstadisticasProduccionDto {
  @IsOptional()
  @IsDateString()
  desde?: string; // YYYY-MM-DD

  @IsOptional()
  @IsDateString()
  hasta?: string; // YYYY-MM-DD

  @IsOptional()
  @IsIn(['month', 'year'])
  periodo?: 'month' | 'year' = 'month';

  @IsOptional()
  @IsUUID()
  productoFinalId?: string;

  @IsOptional()
  @IsIn(['total', 'producto'])
  agruparPor?: 'total' | 'producto' = 'total';
}
