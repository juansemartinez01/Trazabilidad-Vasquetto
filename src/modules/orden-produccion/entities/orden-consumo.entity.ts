import { Entity, Column, ManyToOne } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { OrdenIngrediente } from './orden-ingrediente.entity';
import { LoteMP } from '../../lotes/entities/lote-mp.entity';

@Entity('orden_consumos')
export class OrdenConsumo extends TenantBaseEntity {
  @ManyToOne(() => OrdenIngrediente, (ing) => ing.consumos)
  ingrediente: OrdenIngrediente;

  @ManyToOne(() => LoteMP, { eager: true })
  lote: LoteMP;

  @Column('decimal')
  cantidadKg: number;
}
