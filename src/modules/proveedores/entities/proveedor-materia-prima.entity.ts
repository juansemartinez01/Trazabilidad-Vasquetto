// proveedor-materia-prima.entity.ts
import { Entity, ManyToOne, Unique, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { Proveedor } from './proveedor.entity';
import { MateriaPrima } from '../../materia-prima/entities/materia-prima.entity';

@Entity('proveedor_materia_prima')
@Unique('ux_pmp_tenant_prov_mp', ['tenantId', 'proveedor', 'materiaPrima'])
@Index('ix_pmp_tenant_prov', ['tenantId'])
export class ProveedorMateriaPrima extends TenantBaseEntity {
  @ManyToOne(() => Proveedor, {
    eager: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'proveedor_id' })
  proveedor: Proveedor;

  @ManyToOne(() => MateriaPrima, {
    eager: true,
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'materia_prima_id' })
  materiaPrima: MateriaPrima;
}
