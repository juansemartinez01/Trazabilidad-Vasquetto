import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { Transferencia } from './transferencia.entity';
import { LoteMP } from '../../lotes/entities/lote-mp.entity';
import { LoteProductoFinal } from '../../lotes/entities/lote-producto-final.entity';
import { PresentacionProductoFinal } from '../../producto-final/entities/presentacion-producto-final.entity';

@Entity('transferencia_items')
@Index('ix_transfer_item_tenant', ['tenantId'])
export class TransferenciaItem extends TenantBaseEntity {
  @ManyToOne(() => Transferencia, (t) => t.items, { nullable: false })
  @JoinColumn({ name: 'transferencia_id' })
  transferencia: Transferencia;

  // MP
  @ManyToOne(() => LoteMP, { eager: true, nullable: true })
  @JoinColumn({ name: 'lote_mp_id' })
  loteMp?: LoteMP | null;

  // PF granel
  @ManyToOne(() => LoteProductoFinal, { eager: true, nullable: true })
  @JoinColumn({ name: 'lote_pf_id' })
  lotePf?: LoteProductoFinal | null;

  // PF envasado
  @ManyToOne(() => PresentacionProductoFinal, { eager: true, nullable: true })
  @JoinColumn({ name: 'presentacion_id' })
  presentacion?: PresentacionProductoFinal | null;

  @Column('decimal', { nullable: true })
  cantidadKg?: number | null;

  @Column('decimal', { nullable: true })
  cantidadUnidades?: number | null;

  @Column({ type: 'varchar', nullable: true })
  descripcion?: string | null;
}
