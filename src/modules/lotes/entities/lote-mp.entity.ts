import { Entity, Column, ManyToOne } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { Recepcion } from '../../recepciones/entities/recepcion.entity';
import { MateriaPrima } from '../../materia-prima/entities/materia-prima.entity';
import { Deposito } from '../../deposito/entities/deposito.entity';

@Entity('lotes_mp')
export class LoteMP extends TenantBaseEntity {
  @ManyToOne(() => Recepcion, (r) => r.lotes)
  recepcion: Recepcion;

  @ManyToOne(() => MateriaPrima, { eager: true })
  materiaPrima: MateriaPrima;

  @ManyToOne(() => Deposito, { eager: true })
  deposito: Deposito;

  @Column()
  codigoLote: string;

  @Column({ type: 'date' })
  fechaElaboracion: Date;

  @Column({ type: 'date', nullable: true })
  fechaAnalisis: Date;

  @Column({ type: 'date' })
  fechaVencimiento: Date;

  @Column('decimal')
  cantidadInicialKg: number;

  @Column('decimal')
  cantidadActualKg: number;

  @Column('jsonb', { nullable: true })
  analisis: any; // ej: { humedad: 11.5, proteina: 44.1 }

  @Column('jsonb', { nullable: true })
  documentos: any; // protocolo PDF
}
