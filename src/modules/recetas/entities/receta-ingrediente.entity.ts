import { Entity, Column, ManyToOne } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { RecetaVersion } from './receta-version.entity';
import { MateriaPrima } from '../../materia-prima/entities/materia-prima.entity';

@Entity('receta_ingredientes')
export class RecetaIngrediente extends TenantBaseEntity {
  @ManyToOne(() => RecetaVersion, (v) => v.ingredientes)
  version: RecetaVersion;

  @ManyToOne(() => MateriaPrima, { eager: true })
  materiaPrima: MateriaPrima;

  @Column('decimal')
  porcentaje: number; // porcentaje del total (100%)
}
