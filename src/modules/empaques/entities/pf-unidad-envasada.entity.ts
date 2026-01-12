import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { LoteProductoFinal } from '../../lotes/entities/lote-producto-final.entity';
import { PresentacionProductoFinal } from '../../producto-final/entities/presentacion-producto-final.entity';
import { Deposito } from '../../deposito/entities/deposito.entity';

export type UnidadEnvasadaEstado =
  | 'DISPONIBLE'
  | 'ENTREGADO'
  | 'ANULADO'
  | 'MERMA';

@Entity('pf_unidades_envasadas')
@Unique('ux_unidad_env_tenant_codigo', ['tenantId', 'codigoEtiqueta'])
@Index('ix_unidad_env_tenant_lote', ['tenantId', 'loteOrigen'])
@Index('ix_unidad_env_tenant_pres', ['tenantId', 'presentacion'])
export class PFUnidadEnvasada extends TenantBaseEntity {
  @ManyToOne(() => LoteProductoFinal, { eager: true, nullable: false })
  @JoinColumn({ name: 'lote_pf_origen_id' })
  loteOrigen: LoteProductoFinal;

  @ManyToOne(() => PresentacionProductoFinal, { eager: true, nullable: false })
  @JoinColumn({ name: 'presentacion_id' })
  presentacion: PresentacionProductoFinal;

  @ManyToOne(() => Deposito, { eager: true, nullable: false })
  @JoinColumn({ name: 'deposito_id' })
  deposito: Deposito;

  @Column({ type: 'varchar', length: 80 })
  codigoEtiqueta: string;

  @Column('decimal')
  pesoKg: number;

  @Column({ type: 'varchar', length: 20, default: 'DISPONIBLE' })
  estado: UnidadEnvasadaEstado;
}
