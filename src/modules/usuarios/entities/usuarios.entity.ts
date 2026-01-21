import { Entity, Column, ManyToMany, JoinTable, Unique } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { Rol } from '../../roles/entities/roles.entity';

@Entity('usuarios')
@Unique('ux_usuario_tenant_email', ['tenantId', 'email'])
export class Usuario extends TenantBaseEntity {
  @Column()
  nombre: string;

  @Column()
  email: string;

  @Column({ select: false })
  claveHash: string;

  @ManyToMany(() => Rol)
  @JoinTable({
    name: 'usuario_rol',
    joinColumn: { name: 'usuario_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'rol_id', referencedColumnName: 'id' },
  })
  roles: Rol[];

  @Column({ default: true })
  activo: boolean;
}
