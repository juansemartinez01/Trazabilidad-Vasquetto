import { Entity, Column, Unique } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';

@Entity('roles')
@Unique('ux_role_tenant_nombre', ['tenantId', 'nombre'])
export class Rol extends TenantBaseEntity {
  @Column()
  nombre: string;
}
