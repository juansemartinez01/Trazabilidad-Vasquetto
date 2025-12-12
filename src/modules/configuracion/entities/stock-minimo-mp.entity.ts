import { Entity, Column, ManyToOne, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { MateriaPrima } from '../../materia-prima/entities/materia-prima.entity';

@Entity('stock_minimo_mp')
@Index('ux_stock_minimo_mp_tenant_mp', ['tenantId', 'materiaPrima'], {
  unique: true,
})
export class StockMinimoMP extends TenantBaseEntity {
  @ManyToOne(() => MateriaPrima, { eager: true })
  materiaPrima: MateriaPrima;

  @Column('decimal')
  stockMinKg: number;
}
