// src/modules/producto-final/entities/presentacion-producto-final.entity.ts
import { Entity, Column, ManyToOne, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { ProductoFinal } from './producto-final.entity';

export enum UnidadVenta {
  KG = 'KG',
  BULTO = 'BULTO',
  UNIDAD = 'UNIDAD',
}

@Entity('pf_presentaciones')
@Index('ux_pf_pres_tenant_codigo', ['tenantId', 'codigo'], { unique: true })
export class PresentacionProductoFinal extends TenantBaseEntity {
  @ManyToOne(() => ProductoFinal, (pf) => pf.presentaciones, { eager: false })
  productoFinal: ProductoFinal;

  @Column()
  codigo: string; // SKU

  @Column()
  nombre: string; // "Bolsa 25kg"

  @Column({ type: 'enum', enum: UnidadVenta })
  unidadVenta: UnidadVenta;

  @Column({ type: 'decimal', nullable: true })
  pesoPorUnidadKg: number | null;

  @Column({ default: true })
  activa: boolean;
}
