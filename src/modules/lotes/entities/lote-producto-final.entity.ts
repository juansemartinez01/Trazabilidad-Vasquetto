import { Entity, Column, ManyToOne } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { Deposito } from '../../deposito/entities/deposito.entity';

@Entity('lotes_pf')
export class LoteProductoFinal extends TenantBaseEntity {
  @Column()
  codigoLote: string;

  @Column('decimal')
  cantidadInicialKg: number;

  @Column('decimal')
  cantidadActualKg: number;

  @ManyToOne(() => Deposito, { eager: true })
  deposito: Deposito;

  @Column({ type: 'date' })
  fechaProduccion: Date;

  // 🔹 NUEVO: fecha de vencimiento del lote final (opcional por ahora)
  @Column({ type: 'date', nullable: true })
  fechaVencimiento: Date | null;
}
