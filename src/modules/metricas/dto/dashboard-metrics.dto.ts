import { IsOptional, IsDateString, IsIn } from 'class-validator';

export class DashboardMetricsDto {
  @IsOptional()
  @IsDateString()
  desde?: string; // YYYY-MM-DD

  @IsOptional()
  @IsDateString()
  hasta?: string; // YYYY-MM-DD

  @IsOptional()
  @IsIn(['dia', 'semana', 'mes'])
  periodo?: 'dia' | 'semana' | 'mes'; // opcional
}
