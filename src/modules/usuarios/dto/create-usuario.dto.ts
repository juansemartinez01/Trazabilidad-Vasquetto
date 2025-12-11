import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUsuarioDto {
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;

  @IsArray()
  roles: string[];
}
