import { Entity, Column, OneToMany } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { RecetaVersion } from './receta-version.entity';

@Entity('recetas')
export class Receta extends TenantBaseEntity {
  @Column()
  nombre: string;

  @Column({ nullable: true })
  descripcion: string;

  @OneToMany(() => RecetaVersion, (v) => v.receta)
  versiones: RecetaVersion[];
}
