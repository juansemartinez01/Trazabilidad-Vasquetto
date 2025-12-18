// src/modules/producto-final/entities/producto-final.entity.ts
import { Entity, Column, OneToMany, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { PresentacionProductoFinal } from './presentacion-producto-final.entity';

@Entity('productos_finales')
@Index('ux_pf_tenant_codigo', ['tenantId', 'codigo'], { unique: true })
@Index('ix_pf_tenant_nombre', ['tenantId', 'nombre'])
export class ProductoFinal extends TenantBaseEntity {
  @Column()
  nombre: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  descripcion: string | null;

  @Column()
  codigo: string;

  @Column({ default: true })
  activo: boolean;

  // Para calcular vencimiento por defecto al producir
  @Column({ type: 'int', nullable: true })
  vidaUtilDias: number | null;

  @Column({ type: 'jsonb', nullable: true })
  especificaciones: any;

  @OneToMany(() => PresentacionProductoFinal, (p) => p.productoFinal, {
    cascade: true, // ✅ así podés crear PF + presentaciones de una
  })
  presentaciones: PresentacionProductoFinal[];
}
