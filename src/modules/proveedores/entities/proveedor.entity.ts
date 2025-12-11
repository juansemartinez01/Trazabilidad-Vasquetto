import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';

@Entity('proveedores')
@Index(['tenantId', 'razonSocial'])
@Index(['tenantId', 'cuit'])
export class Proveedor extends TenantBaseEntity {
  

  @Column({ length: 200 })
  razonSocial: string;

  @Column({ length: 20, nullable: true })
  cuit?: string;

  @Column({ length: 150, nullable: true })
  direccion?: string;

  @Column({ length: 100, nullable: true })
  localidad?: string;

  @Column({ length: 100, nullable: true })
  provincia?: string;

  @Column({ length: 100, nullable: true })
  contacto?: string;

  @Column({ length: 30, nullable: true })
  telefono?: string;

  @Column({ length: 150, nullable: true })
  email?: string;

  @Column({ default: true })
  activo: boolean;
}
