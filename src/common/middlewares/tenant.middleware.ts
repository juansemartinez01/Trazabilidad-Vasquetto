import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      throw new UnauthorizedException(
        'Tenant ID missing in x-tenant-id header',
      );
    }

    req['tenantId'] = tenantId;
    next();
  }
}
