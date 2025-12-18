import { Entity, Column, ManyToMany, JoinTable } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { Rol } from '../../roles/entities/roles.entity';

@Entity('usuarios')
export class Usuario extends TenantBaseEntity {
  @Column()
  nombre: string;

  @Column({ unique: true })
  email: string;

  @Column()
  claveHash: string;

  @ManyToMany(() => Rol)
  @JoinTable()
  roles: Rol[];

  @Column({ default: true })
  activo: boolean;
}
