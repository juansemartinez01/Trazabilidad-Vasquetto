import { Controller, Post, Body, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUsuarioDto } from '../usuarios/dto/create-usuario.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('registrar')
  registrar(@Body() dto: CreateUsuarioDto, @Req() req: any) {
    return this.authService.registrar(dto, req.tenantId);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }
}
