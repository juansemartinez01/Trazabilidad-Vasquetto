import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantS3Map } from '../../common/entities/tenant-s3-map.entity';
import { AdminTenantsService } from './admin-tenants.service';
import { AdminTenantsController } from './admin-tenants.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TenantS3Map])],
  providers: [AdminTenantsService],
  controllers: [AdminTenantsController],
})
export class AdminTenantsModule {}
