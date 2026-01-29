// src/modules/insumos/entities/insumo-consumo-pf.entity.ts
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { Insumo } from './insumo.entity';
import { ProductoFinal } from '../../producto-final/entities/producto-final.entity';
import { PresentacionProductoFinal } from '../../producto-final/entities/presentacion-producto-final.entity';

@Entity('insumo_consumo_pf')
@Index('ix_icpf_tenant', ['tenantId'])
@Index('ix_icpf_tenant_pf', ['tenantId', 'productoFinalId'])
@Index('ix_icpf_tenant_pres', ['tenantId', 'presentacionId'])
export class InsumoConsumoPF extends TenantBaseEntity {
  @ManyToOne(() => Insumo, {
    eager: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'insumo_id' })
  insumo: Insumo;

  @Column({ name: 'insumo_id', type: 'uuid' })
  insumoId: string;

  @ManyToOne(() => ProductoFinal, {
    eager: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'producto_final_id' })
  productoFinal?: ProductoFinal | null;

  @Column({ name: 'producto_final_id', type: 'uuid', nullable: true })
  productoFinalId?: string | null;

  @ManyToOne(() => PresentacionProductoFinal, {
    eager: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'presentacion_id' })
  presentacion?: PresentacionProductoFinal | null;

  @Column({ name: 'presentacion_id', type: 'uuid', nullable: true })
  presentacionId?: string | null;

  // consumo por unidad (ej: 1 etiqueta por unidad)
  @Column('decimal', { name: 'cantidad_por_unidad', nullable: true })
  cantidadPorUnidad?: number | null;

  // consumo por kg (opcional, por si lo necesitás para algún empaque/film por kg)
  @Column('decimal', { name: 'cantidad_por_kg', nullable: true })
  cantidadPorKg?: number | null;

  @Column({ default: true })
  activo: boolean;

  @Column({ name: 'es_envase', type: 'boolean', default: false })
  esEnvase: boolean;
}
