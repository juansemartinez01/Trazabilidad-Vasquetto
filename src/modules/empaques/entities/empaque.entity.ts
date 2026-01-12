import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { LoteProductoFinal } from '../../lotes/entities/lote-producto-final.entity';
import { Deposito } from '../../deposito/entities/deposito.entity';
import { Usuario } from '../../usuarios/entities/usuarios.entity';
import { EmpaqueItem } from './empaque-item.entity';

export type EmpaqueEstado = 'BORRADOR' | 'CONFIRMADO' | 'ANULADO';

@Entity('empaques')
@Index('ix_empaques_tenant_fecha', ['tenantId', 'fecha'])
@Index('ix_empaques_tenant_lote', ['tenantId', 'lote'])
export class Empaque extends TenantBaseEntity {
  @ManyToOne(() => LoteProductoFinal, { eager: true, nullable: false })
  @JoinColumn({ name: 'lote_pf_id' })
  lote: LoteProductoFinal;

  @ManyToOne(() => Deposito, { eager: true, nullable: false })
  @JoinColumn({ name: 'deposito_id' })
  deposito: Deposito;

  @ManyToOne(() => Usuario, { eager: true, nullable: false })
  @JoinColumn({ name: 'responsable_id' })
  responsable: Usuario;

  @Column({ type: 'date' })
  fecha: Date;

  @Column({ type: 'varchar', length: 20, default: 'BORRADOR' })
  estado: EmpaqueEstado;

  @Column({ type: 'varchar', length: 500, nullable: true })
  observaciones: string | null;

  @OneToMany(() => EmpaqueItem, (i) => i.empaque, { cascade: true })
  items: EmpaqueItem[];
}
