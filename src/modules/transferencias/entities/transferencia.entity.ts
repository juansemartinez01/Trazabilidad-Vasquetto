import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { Deposito } from '../../deposito/entities/deposito.entity';
import { Usuario } from '../../usuarios/entities/usuarios.entity';
import { TransferenciaItem } from './transferencia-item.entity';
import { TransferenciaUnidad } from './transferencia-unidad.entity';

export enum TransferenciaTipo {
  MP = 'MP',
  PF_GRANEL = 'PF_GRANEL',
  PF_ENVASADO = 'PF_ENVASADO',
}

export enum TransferenciaEstado {
  BORRADOR = 'BORRADOR',
  CONFIRMADA = 'CONFIRMADA',
  ANULADA = 'ANULADA',
}

@Entity('transferencias')
@Index('ix_transfer_tenant_fecha', ['tenantId', 'fecha'])
export class Transferencia extends TenantBaseEntity {
  @Column({ type: 'date' })
  fecha: string;

  @ManyToOne(() => Deposito, { eager: true, nullable: false })
  @JoinColumn({ name: 'origen_deposito_id' })
  origenDeposito: Deposito;

  @ManyToOne(() => Deposito, { eager: true, nullable: false })
  @JoinColumn({ name: 'destino_deposito_id' })
  destinoDeposito: Deposito;

  @Column({ type: 'enum', enum: TransferenciaTipo })
  tipo: TransferenciaTipo;

  @Column({
    type: 'enum',
    enum: TransferenciaEstado,
    default: TransferenciaEstado.BORRADOR,
  })
  estado: TransferenciaEstado;

  @ManyToOne(() => Usuario, { eager: true, nullable: true })
  @JoinColumn({ name: 'responsable_id' })
  responsable?: Usuario | null;

  @Column({ type: 'varchar', nullable: true })
  observaciones?: string | null;

  @OneToMany(() => TransferenciaItem, (it) => it.transferencia, {
    cascade: true,
  })
  items: TransferenciaItem[];

  @OneToMany(() => TransferenciaUnidad, (u) => u.transferencia, {
    cascade: true,
  })
  unidades: TransferenciaUnidad[];
}
