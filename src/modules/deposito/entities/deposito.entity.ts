import { Entity, Column } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';

@Entity('depositos')
export class Deposito extends TenantBaseEntity {
  @Column()
  nombre: string;

  @Column({ nullable: true })
  ubicacion: string;
}
