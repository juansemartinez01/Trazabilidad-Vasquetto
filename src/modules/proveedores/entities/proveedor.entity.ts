import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { ProveedorMateriaPrima } from './proveedor-materia-prima.entity';

@Entity('proveedores')
@Index(['tenantId', 'razonSocial'])
@Index('ux_prov_tenant_cuit', ['tenantId', 'cuit'], {
  unique: true,
  where: `"cuit" IS NOT NULL`,
})
export class Proveedor extends TenantBaseEntity {
  @Column({ length: 200 })
  razonSocial: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  cuit: string | null;

  @Column({ length: 150, nullable: true })
  direccion?: string;

  @Column({ length: 100, nullable: true })
  localidad?: string;

  @Column({ length: 100, nullable: true })
  provincia?: string;

  @Column({ length: 100, nullable: true })
  contacto?: string;

  @Column({ length: 30, nullable: true })
  telefono?: string;

  @Column({ length: 150, nullable: true })
  email?: string;

  @Column({ default: true })
  activo: boolean;

  // ✅ nuevos
  @Column({ length: 50, nullable: true })
  numeroRenspa?: string;

  @Column({ length: 50, nullable: true })
  numeroInscripcionSenasa?: string;

  // ✅ relación con MP vía tabla intermedia
  @OneToMany(() => ProveedorMateriaPrima, (x) => x.proveedor)
  materiasPrimasLink: ProveedorMateriaPrima[];
}
