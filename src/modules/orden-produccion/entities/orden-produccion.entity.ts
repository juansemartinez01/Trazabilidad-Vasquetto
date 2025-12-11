import { Entity, Column, ManyToOne, OneToMany } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { RecetaVersion } from '../../recetas/entities/receta-version.entity';
import { Usuario } from '../../usuarios/entities/usuarios.entity';
import { LoteProductoFinal } from '../../lotes/entities/lote-producto-final.entity';
import { OrdenIngrediente } from './orden-ingrediente.entity';

@Entity('ordenes_produccion')
export class OrdenProduccion extends TenantBaseEntity {
  @ManyToOne(() => RecetaVersion, { eager: true })
  recetaVersion: RecetaVersion;

  @Column('decimal')
  cantidadKg: number;

  @ManyToOne(() => Usuario, { eager: true })
  responsable: Usuario;

  @OneToMany(() => OrdenIngrediente, (ing) => ing.orden, { cascade: true })
  ingredientes: OrdenIngrediente[];

  @Column({ default: 'pendiente' })
  estado: 'pendiente' | 'procesando' | 'finalizada' | 'cancelada';

  @ManyToOne(() => LoteProductoFinal, { nullable: true, eager: true })
  loteFinal: LoteProductoFinal;

  @Column({ nullable: true })
  observaciones: string;
}
