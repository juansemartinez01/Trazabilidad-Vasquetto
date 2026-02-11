import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantS3Map } from '../entities/tenant-s3-map.entity';

type CacheEntry = { value: string; exp: number };

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 min

  constructor(
    @InjectRepository(TenantS3Map)
    private repo: Repository<TenantS3Map>,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      throw new UnauthorizedException(
        'Tenant ID missing in x-tenant-id header',
      );
    }

    // Guardamos tenant plataforma
    (req as any).tenantId = tenantId;

    // 🔐 Validación recomendada: si hay token, debe coincidir con el tenant header
    const tokenTenantId = (req as any).usuario?.tenantId;
    if (tokenTenantId && tokenTenantId !== tenantId) {
      throw new UnauthorizedException(
        'Tenant header does not match token tenant',
      );
    }

    // cache
    const now = Date.now();
    const cached = this.cache.get(tenantId);
    if (cached && cached.exp > now) {
      (req as any).s3TenantKey = cached.value;
      return next();
    }

    // DB lookup
    const row = await this.repo.findOne({
      where: { tenantId, activo: true },
      select: ['tenantId', 's3TenantKey', 'activo'],
    });

    if (!row?.s3TenantKey) {
      throw new UnauthorizedException(
        'No S3 tenant mapping found for this tenant',
      );
    }

    (req as any).s3TenantKey = row.s3TenantKey;
    this.cache.set(tenantId, {
      value: row.s3TenantKey,
      exp: now + this.TTL_MS,
    });

    next();
  }
}
