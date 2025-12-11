import { Entity, Column, ManyToOne } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { Entrega } from './entrega.entity';
import { LoteProductoFinal } from '../../lotes/entities/lote-producto-final.entity';
import { Deposito } from '../../deposito/entities/deposito.entity';

@Entity('entrega_items')
export class EntregaItem extends TenantBaseEntity {
  @ManyToOne(() => Entrega, (entrega) => entrega.items)
  entrega: Entrega;

  @ManyToOne(() => LoteProductoFinal, { eager: true })
  lote: LoteProductoFinal;

  @ManyToOne(() => Deposito, { eager: true })
  deposito: Deposito;

  @Column('decimal')
  cantidadKg: number;

  @Column('decimal')
  cantidadBultos: number;
}
