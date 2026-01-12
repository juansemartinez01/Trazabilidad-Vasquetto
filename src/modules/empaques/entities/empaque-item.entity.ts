import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { Empaque } from './empaque.entity';
import { PresentacionProductoFinal } from '../../producto-final/entities/presentacion-producto-final.entity';

@Entity('empaque_items')
@Index('ix_empaque_items_tenant_empaque', ['tenantId', 'empaque'])
export class EmpaqueItem extends TenantBaseEntity {
  @ManyToOne(() => Empaque, (e) => e.items, { eager: false, nullable: false })
  @JoinColumn({ name: 'empaque_id' })
  empaque: Empaque;

  @ManyToOne(() => PresentacionProductoFinal, { eager: true, nullable: false })
  @JoinColumn({ name: 'presentacion_id' })
  presentacion: PresentacionProductoFinal;

  @Column('decimal')
  cantidadKg: number;

  // Para BULTO/UNIDAD: cantidad de unidades/bultos generados
  @Column('decimal', { nullable: true })
  cantidadUnidades: number | null;
}
