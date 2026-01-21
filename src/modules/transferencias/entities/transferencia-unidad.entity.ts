import { Entity, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { Transferencia } from './transferencia.entity';
import { PFUnidadEnvasada } from '../../empaques/entities/pf-unidad-envasada.entity';

@Entity('transferencia_unidades')
@Unique('ux_transfer_unidad', ['tenantId', 'transferencia', 'unidad'])
@Index('ix_transfer_unidad_tenant_transfer', ['tenantId', 'transferencia'])
export class TransferenciaUnidad extends TenantBaseEntity {
  @ManyToOne(() => Transferencia, (t) => t.unidades, { nullable: false })
  @JoinColumn({ name: 'transferencia_id' })
  transferencia: Transferencia;

  @ManyToOne(() => PFUnidadEnvasada, { eager: true, nullable: false })
  @JoinColumn({ name: 'unidad_id' })
  unidad: PFUnidadEnvasada;
}
