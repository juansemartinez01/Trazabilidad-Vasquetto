import { Entity, Column } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';

@Entity('insumos')
export class Insumo extends TenantBaseEntity {
  @Column()
  nombre: string;

  @Column()
  unidad: string;

  @Column('decimal', { default: 0 })
  stockActual: number;

  @Column('decimal', { nullable: true })
  stockMinimo: number;
}
