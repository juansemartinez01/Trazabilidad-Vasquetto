import { Entity, Column, OneToMany, ManyToOne } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { RecetaVersion } from './receta-version.entity';
import { ProductoFinal } from 'src/modules/producto-final/entities/producto-final.entity';

@Entity('recetas')
export class Receta extends TenantBaseEntity {
  @Column()
  nombre: string;

  @Column({ nullable: true })
  descripcion: string;

  @OneToMany(() => RecetaVersion, (v) => v.receta)
  versiones: RecetaVersion[];

  // ✅ nuevo: qué producto final fabrica esta receta
  @ManyToOne(() => ProductoFinal, { eager: true, nullable: false })
  productoFinal: ProductoFinal;
}
