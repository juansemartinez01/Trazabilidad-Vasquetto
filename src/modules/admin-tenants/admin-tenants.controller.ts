import { Controller, Get, Param, Post, Body, Delete } from '@nestjs/common';
import { AdminTenantsService } from './admin-tenants.service';
import { SetTenantS3KeyDto } from './dto/set-tenant-s3-key.dto';

@Controller('admin/tenants')
export class AdminTenantsController {
  constructor(private readonly service: AdminTenantsService) {}

  @Post(':tenantId/s3-key')
  set(@Param('tenantId') tenantId: string, @Body() dto: SetTenantS3KeyDto) {
    return this.service.setS3Key(tenantId, dto.s3TenantKey);
  }

  @Get(':tenantId/s3-key')
  get(@Param('tenantId') tenantId: string) {
    return this.service.getS3Key(tenantId);
  }

  @Delete(':tenantId/s3-key')
  disable(@Param('tenantId') tenantId: string) {
    return this.service.disable(tenantId);
  }
}
