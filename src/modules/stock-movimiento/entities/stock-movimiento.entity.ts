import { Entity, Column, ManyToOne } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { LoteMP } from '../../lotes/entities/lote-mp.entity';
import { LoteProductoFinal } from '../../lotes/entities/lote-producto-final.entity';
import { Deposito } from '../../deposito/entities/deposito.entity';

export enum TipoMovimiento {
  RECEPCION = 'RECEPCION',
  PRODUCCION_CONSUMO = 'PRODUCCION_CONSUMO',
  PRODUCCION_INGRESO = 'PRODUCCION_INGRESO',
  ENTREGA = 'ENTREGA',
  AJUSTE = 'AJUSTE',
  MERMA = 'MERMA',
}

@Entity('stock_movimientos')
export class StockMovimiento extends TenantBaseEntity {
  @Column({ type: 'enum', enum: TipoMovimiento })
  tipo: TipoMovimiento;

  @ManyToOne(() => LoteMP, { nullable: true, eager: true })
  loteMP?: LoteMP;

  @ManyToOne(() => LoteProductoFinal, { nullable: true, eager: true })
  lotePF?: LoteProductoFinal;

  @ManyToOne(() => Deposito, { eager: true })
  deposito: Deposito;

  @Column('decimal')
  cantidadKg: number;

  @Column({ nullable: true })
  referenciaId?: string; // id de orden de producción o recepción
}
