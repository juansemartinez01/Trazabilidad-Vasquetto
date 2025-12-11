export class DashboardMetricsDto {
  desde?: string; // YYYY-MM-DD
  hasta?: string; // YYYY-MM-DD
  periodo?: 'dia' | 'semana' | 'mes'; // opcional, por defecto mes
}
