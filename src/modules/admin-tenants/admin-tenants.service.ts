import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantS3Map } from '../../common/entities/tenant-s3-map.entity';

@Injectable()
export class AdminTenantsService {
  constructor(
    @InjectRepository(TenantS3Map)
    private repo: Repository<TenantS3Map>,
  ) {}

  async setS3Key(tenantId: string, s3TenantKey: string) {
    const key = (s3TenantKey ?? '').trim();
    if (!key) throw new BadRequestException('s3TenantKey is required');

    // upsert por tenantId
    const existing = await this.repo.findOne({ where: { tenantId } });

    if (existing) {
      existing.s3TenantKey = key;
      existing.activo = true;
      await this.repo.save(existing);
      return { tenantId, s3TenantKey: key, updated: true };
    }

    const created = this.repo.create({
      tenantId,
      s3TenantKey: key,
      activo: true,
    });
    await this.repo.save(created);
    return { tenantId, s3TenantKey: key, created: true };
  }

  async getS3Key(tenantId: string) {
    const row = await this.repo.findOne({
      where: { tenantId },
      select: ['tenantId', 's3TenantKey', 'activo'],
    });
    if (!row) throw new NotFoundException('Mapping not found');
    return row;
  }

  async disable(tenantId: string) {
    const row = await this.repo.findOne({ where: { tenantId } });
    if (!row) throw new NotFoundException('Mapping not found');
    row.activo = false;
    await this.repo.save(row);
    return { tenantId, disabled: true };
  }
}
