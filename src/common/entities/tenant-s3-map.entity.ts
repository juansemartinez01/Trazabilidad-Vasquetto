import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tenant_s3_map')
export class TenantS3Map {
  // tenant de tu plataforma (x-tenant-id)
  @PrimaryColumn('uuid', { name: 'tenant_id' })
  tenantId: string;

  // tenantKey del S3/Images API
  @Column({ name: 's3_tenant_key', type: 'varchar', length: 100, unique: true })
  s3TenantKey: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
