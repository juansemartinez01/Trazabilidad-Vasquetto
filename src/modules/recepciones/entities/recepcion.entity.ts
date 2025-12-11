import { Entity, Column, OneToMany, ManyToOne } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { Proveedor } from '../../proveedores/entities/proveedor.entity';
import { LoteMP } from '../../lotes/entities/lote-mp.entity';

@Entity('recepciones')
export class Recepcion extends TenantBaseEntity {
  @ManyToOne(() => Proveedor, { eager: true })
  proveedor: Proveedor;

  @Column()
  numeroRemito: string;

  @Column({ type: 'date' })
  fechaRemito: Date;

  @Column({ nullable: true })
  transportista: string;

  @Column({ type: 'jsonb', nullable: true })
  documentos: any; // PDFs adjuntos

  @OneToMany(() => LoteMP, (lote) => lote.recepcion, { cascade: true })
  lotes: LoteMP[];
}
