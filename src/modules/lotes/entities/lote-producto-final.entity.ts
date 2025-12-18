import { Entity, Column, ManyToOne } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { Deposito } from '../../deposito/entities/deposito.entity';
import { ProductoFinal } from 'src/modules/producto-final/entities/producto-final.entity';


export enum LotePfEstado {
  LISTO = 'LISTO',
  RETENIDO = 'RETENIDO',
  DESCARTADO = 'DESCARTADO',
  VENCIDO = 'VENCIDO',
  ENTREGADO = 'ENTREGADO',
}

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

  // ✅ NUEVO: estado del lote PF
  @Column({
    type: 'enum',
    enum: LotePfEstado,
    default: LotePfEstado.RETENIDO, // recomendado: arranca retenido hasta liberar
  })
  estado: LotePfEstado;

  // ✅ opcional: motivo y fecha del cambio de estado
  @Column({ type: 'varchar', nullable: true })
  motivoEstado: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  fechaEstado: Date | null;

  @ManyToOne(() => ProductoFinal, { eager: true, nullable: false })
  productoFinal: ProductoFinal;
}
