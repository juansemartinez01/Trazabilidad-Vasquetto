import { Entity, Column, ManyToOne, OneToMany } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { OrdenProduccion } from './orden-produccion.entity';
import { MateriaPrima } from '../../materia-prima/entities/materia-prima.entity';
import { OrdenConsumo } from './orden-consumo.entity';

@Entity('orden_ingredientes')
export class OrdenIngrediente extends TenantBaseEntity {
  @ManyToOne(() => OrdenProduccion, (o) => o.ingredientes)
  orden: OrdenProduccion;

  @ManyToOne(() => MateriaPrima, { eager: true })
  materiaPrima: MateriaPrima;

  @Column('decimal')
  porcentaje: number;

  @Column('decimal')
  kgNecesarios: number;

  @OneToMany(() => OrdenConsumo, (c) => c.ingrediente, { cascade: true })
  consumos: OrdenConsumo[];
}
