import { Entity, Column, ManyToOne, OneToMany } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { Cliente } from '../../clientes/entities/cliente.entity';
import { Usuario } from '../../usuarios/entities/usuarios.entity';
import { EntregaItem } from './entrega-item.entity';

@Entity('entregas')
export class Entrega extends TenantBaseEntity {
  @ManyToOne(() => Cliente, { eager: true })
  cliente: Cliente;

  @Column()
  numeroRemito: string;

  @Column({ type: 'date' })
  fecha: Date;

  @ManyToOne(() => Usuario, { eager: true })
  chofer: Usuario;

  @Column({ nullable: true })
  observaciones: string;

  @OneToMany(() => EntregaItem, (item) => item.entrega, { cascade: true })
  items: EntregaItem[];
}
