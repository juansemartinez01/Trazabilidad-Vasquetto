import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { OrdenIngrediente } from './orden-ingrediente.entity';
import { LoteMP } from '../../lotes/entities/lote-mp.entity';

@Entity('orden_consumos')
export class OrdenConsumo extends TenantBaseEntity {
  @ManyToOne(() => OrdenIngrediente, (ing) => ing.consumos, { nullable: false })
  @JoinColumn({ name: 'ingrediente_id' })
  ingrediente: OrdenIngrediente;

  @ManyToOne(() => LoteMP, { eager: true, nullable: false })
  @JoinColumn({ name: 'lote_id' })
  lote: LoteMP;

  @Column('decimal', { name: 'cantidad_kg' })
  cantidadKg: number;
}
