import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateDepositoDto {
  @IsString()
  @MaxLength(100)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ubicacion?: string;
}
