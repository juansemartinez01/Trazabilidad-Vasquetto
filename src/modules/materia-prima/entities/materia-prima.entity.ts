import { Entity, Column } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';

@Entity('materias_primas')
export class MateriaPrima extends TenantBaseEntity {
  @Column()
  nombre: string;

  @Column()
  unidadMedida: string; // kg, litros, etc.

  @Column({ nullable: true })
  descripcion: string;

  @Column({ type: 'jsonb', nullable: true })
  parametrosCalidadEsperados: any;
  // ejemplo: { humedad_max: 12, ph_min: 4.0 }
}
