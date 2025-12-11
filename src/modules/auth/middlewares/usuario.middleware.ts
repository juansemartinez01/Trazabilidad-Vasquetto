import { Injectable, NestMiddleware } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class UsuarioMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const token = req.headers['authorization']?.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || '');
        req.usuario = decoded;
      } catch {}
    }

    next();
  }
}
