import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly roles: string[]) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const usuario = req.usuario;

    if (!usuario) throw new ForbiddenException('Usuario no autenticado');

    const tieneRol = usuario.roles.some((r) => this.roles.includes(r.nombre));

    if (!tieneRol) {
      throw new ForbiddenException('No tenés permisos');
    }

    return true;
  }
}
