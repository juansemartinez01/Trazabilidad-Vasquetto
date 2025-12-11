import { Entity, Column } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';

@Entity('roles')
export class Rol extends TenantBaseEntity {
  @Column({ unique: true })
  nombre: string; // admin, produccion, logistica, calidad
}
