import { Entity, Column, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { PresentacionProductoFinal } from '../../producto-final/entities/presentacion-producto-final.entity';
import { Deposito } from '../../deposito/entities/deposito.entity';

@Entity('stock_presentaciones')
@Unique('ux_stock_pres_tenant_pres_dep', [
  'tenantId',
  'presentacion',
  'deposito',
])
@Index('ix_stock_pres_tenant', ['tenantId'])
export class StockPresentacion extends TenantBaseEntity {
  @ManyToOne(() => PresentacionProductoFinal, { eager: true, nullable: false })
  @JoinColumn({ name: 'presentacion_id' })
  presentacion: PresentacionProductoFinal;

  @ManyToOne(() => Deposito, { eager: true, nullable: false })
  @JoinColumn({ name: 'deposito_id' })
  deposito: Deposito;

  // Para unidadVenta=KG
  @Column('decimal', { default: 0 })
  stockKg: number;

  // Para BULTO/UNIDAD
  @Column('decimal', { default: 0 })
  stockUnidades: number;
}
