import { Entity, Column, ManyToOne, OneToMany } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { Receta } from './receta.entity';
import { RecetaIngrediente } from './receta-ingrediente.entity';

@Entity('receta_versiones')
export class RecetaVersion extends TenantBaseEntity {
  @ManyToOne(() => Receta, (r) => r.versiones, { eager: true })
  receta: Receta;

  @Column()
  numeroVersion: number;

  @Column({ default: true })
  activa: boolean;

  @OneToMany(() => RecetaIngrediente, (i) => i.version, { cascade: true })
  ingredientes: RecetaIngrediente[];
}
