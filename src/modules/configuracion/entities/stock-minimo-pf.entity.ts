import { Entity, Column, ManyToOne, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { ProductoFinal } from '../../producto-final/entities/producto-final.entity';

@Entity('stock_minimo_pf')
@Index('ux_min_pf_tenant_pf', ['tenantId', 'productoFinal'], { unique: true })
export class StockMinimoPF extends TenantBaseEntity {
  @ManyToOne(() => ProductoFinal, { eager: true, nullable: false })
  productoFinal: ProductoFinal;

  @Column('decimal', { default: 0 })
  stockMinKg: number;
}
