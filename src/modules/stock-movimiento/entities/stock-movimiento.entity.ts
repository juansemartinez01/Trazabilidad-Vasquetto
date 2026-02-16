import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { LoteMP } from '../../lotes/entities/lote-mp.entity';
import { LoteProductoFinal } from '../../lotes/entities/lote-producto-final.entity';
import { Deposito } from '../../deposito/entities/deposito.entity';
import { PresentacionProductoFinal } from 'src/modules/producto-final/entities/presentacion-producto-final.entity';
import { PFUnidadEnvasada } from 'src/modules/empaques/entities/pf-unidad-envasada.entity';

export enum TipoMovimiento {
  RECEPCION = 'RECEPCION',
  PRODUCCION_CONSUMO = 'PRODUCCION_CONSUMO',
  PRODUCCION_INGRESO = 'PRODUCCION_INGRESO',
  ENTREGA = 'ENTREGA',
  AJUSTE = 'AJUSTE',
  MERMA = 'MERMA',

  MERMA_MP = 'MERMA_MP',
  MERMA_PF = 'MERMA_PF',
  MERMA_PFE = 'MERMA_PFE',
  EMPAQUE_CONSUMO_PF = 'EMPAQUE_CONSUMO_PF',
  EMPAQUE_INGRESO_PRES = 'EMPAQUE_INGRESO_PRES',

  // ✅ NUEVOS
  TRANSFERENCIA_MP = 'TRANSFERENCIA_MP',
  TRANSFERENCIA_PF = 'TRANSFERENCIA_PF',
  TRANSFERENCIA_ENVASADO = 'TRANSFERENCIA_ENVASADO',
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

  // StockMovimiento entity
  @Column({ nullable: true })
  motivo?: string;

  @Column({ nullable: true })
  responsableId?: string;

  @Column('jsonb', { nullable: true })
  evidencia?: any;

  // dentro de la entity StockMovimiento:
  @ManyToOne(() => PresentacionProductoFinal, { eager: true, nullable: true })
  @JoinColumn({ name: 'presentacion_id' })
  presentacion?: PresentacionProductoFinal | null;

  @Column('decimal', { nullable: true })
  cantidadUnidades?: number | null;

  @ManyToOne(() => PFUnidadEnvasada, { eager: false, nullable: true })
  @JoinColumn({ name: 'unidad_envasada_id' })
  unidadEnvasada?: PFUnidadEnvasada | null;
}
