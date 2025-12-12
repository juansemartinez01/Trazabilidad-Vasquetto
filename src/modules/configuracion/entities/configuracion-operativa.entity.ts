import { Entity, Column } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';

@Entity('configuracion_operativa')
export class ConfiguracionOperativa extends TenantBaseEntity {
  @Column({ type: 'int', default: 30 })
  diasProximoVencimiento: number;
}
