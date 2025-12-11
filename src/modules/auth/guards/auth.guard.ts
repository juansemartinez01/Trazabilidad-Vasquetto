import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) throw new UnauthorizedException('Token requerido');

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      req.usuario = decoded;
      return true;
    } catch (e) {
      throw new UnauthorizedException('Token inválido');
    }
  }
}
