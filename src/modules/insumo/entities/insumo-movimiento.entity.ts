import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { Insumo } from './insumo.entity';

export enum TipoMovimientoInsumo {
  INGRESO = 'INGRESO',
  EGRESO = 'EGRESO',
  AJUSTE = 'AJUSTE',
  MERMA = 'MERMA',
}

@Entity('insumo_movimientos')
@Index('ix_ins_mov_tenant', ['tenantId'])
@Index('ix_ins_mov_tenant_insumo', ['tenantId', 'insumoId'])
@Index('ix_ins_mov_tenant_created', ['tenantId', 'createdAt'])
export class InsumoMovimiento extends TenantBaseEntity {
  @ManyToOne(() => Insumo, {
    eager: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'insumo_id' })
  insumo!: Insumo;

  @Column({ name: 'insumo_id' })
  insumoId!: string;

  @Column({ type: 'enum', enum: TipoMovimientoInsumo })
  tipo!: TipoMovimientoInsumo;

  // positivo o negativo según corresponda
  @Column('decimal')
  cantidad!: number;

  @Column({ type: 'text', nullable: true })
  motivo?: string;

  @Column({ type: 'varchar', nullable: true })
  referenciaId?: string;

  @Column({ type: 'varchar', nullable: true })
  responsableId?: string;

  // ✅ NUEVO: adjuntos (remitos, fotos, comprobantes, etc.)
  @Column({ type: 'jsonb', nullable: true })
  documentos?: any;
}
