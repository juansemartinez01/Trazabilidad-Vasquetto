import { Entity, Column } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';

@Entity('auditoria')
export class Auditoria extends TenantBaseEntity {
  @Column()
  usuarioId: string;

  @Column()
  accion: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;
}
