import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Receta } from './entities/receta.entity';
import { RecetaVersion } from './entities/receta-version.entity';
import { RecetaIngrediente } from './entities/receta-ingrediente.entity';
import { MateriaPrima } from '../materia-prima/entities/materia-prima.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ProductoFinal } from '../producto-final/entities/producto-final.entity';

@Injectable()
export class RecetasService {
  constructor(
    @InjectRepository(Receta) private recetaRepo: Repository<Receta>,
    @InjectRepository(RecetaVersion)
    private versionRepo: Repository<RecetaVersion>,
    @InjectRepository(RecetaIngrediente)
    private ingRepo: Repository<RecetaIngrediente>,
    @InjectRepository(MateriaPrima) private mpRepo: Repository<MateriaPrima>,
    private auditoria: AuditoriaService,
    @InjectRepository(ProductoFinal)
    private pfRepo: Repository<ProductoFinal>,
  ) {}

  async crear(tenantId: string, usuarioId: string, dto: any) {
    const total = dto.ingredientes.reduce(
      (s, i) => s + Number(i.porcentaje),
      0,
    );
    if (total !== 100) {
      throw new BadRequestException('Los porcentajes deben sumar 100%');
    }

    const productoFinal = await this.pfRepo.findOne({
      where: { id: dto.productoFinalId, tenantId },
    });
    if (!productoFinal)
      throw new NotFoundException('Producto final no encontrado');

    const receta = this.recetaRepo.create({
      tenantId,
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      productoFinal,
    });

    await this.recetaRepo.save(receta);

    const version = this.versionRepo.create({
      tenantId,
      receta,
      numeroVersion: 1,
      activa: true,
    });

    await this.versionRepo.save(version);

    // Ingredientes
    for (const ing of dto.ingredientes) {
      const mp = await this.mpRepo.findOne({
        where: { id: ing.materiaPrimaId, tenantId },
      });
      if (!mp) throw new NotFoundException('Materia prima no encontrada');

      const nuevoIng = this.ingRepo.create({
        tenantId,
        version,
        materiaPrima: mp,
        porcentaje: ing.porcentaje,
      });
      await this.ingRepo.save(nuevoIng);
    }

    await this.auditoria.registrar(tenantId, usuarioId, 'RECETA_CREADA', {
      recetaId: receta.id,
    });

    return this.findOne(receta.id, tenantId);
  }

  async actualizar(
    tenantId: string,
    recetaId: string,
    usuarioId: string,
    dto: any,
  ) {
    const receta = await this.recetaRepo.findOne({
      where: { id: recetaId, tenantId },
    });
    if (!receta) throw new NotFoundException('Receta no encontrada');

    const total = dto.ingredientes.reduce(
      (s, i) => s + Number(i.porcentaje),
      0,
    );
    if (total !== 100)
      throw new BadRequestException('Los porcentajes deben sumar 100%');

    // Inactivar versión actual
    const versionActual = await this.versionRepo.findOne({
      where: { receta: { id: recetaId }, activa: true, tenantId },
    });
    if (!versionActual) {
      throw new NotFoundException('Versión activa de la receta no encontrada');
    }
    versionActual.activa = false;
    await this.versionRepo.save(versionActual);

    // Nueva versión
    const nuevaVersion = this.versionRepo.create({
      tenantId,
      receta,
      numeroVersion: versionActual.numeroVersion + 1,
      activa: true,
    });
    await this.versionRepo.save(nuevaVersion);

    // Ingredientes
    for (const ing of dto.ingredientes) {
      const mp = await this.mpRepo.findOne({
        where: { id: ing.materiaPrimaId, tenantId },
      });
      if (!mp) throw new NotFoundException('Materia prima no encontrada');

      await this.ingRepo.save(
        this.ingRepo.create({
          tenantId,
          version: nuevaVersion,
          materiaPrima: mp,
          porcentaje: ing.porcentaje,
        }),
      );
    }

    await this.auditoria.registrar(tenantId, usuarioId, 'RECETA_MODIFICADA', {
      recetaId,
    });

    return this.findOne(recetaId, tenantId);
  }

  findAll(tenantId: string) {
    return this.recetaRepo.find({
      where: { tenantId },
      relations: [
        'versiones',
        'versiones.ingredientes',
        'versiones.ingredientes.materiaPrima',
      ],
    });
  }

  findOne(id: string, tenantId: string) {
    return this.recetaRepo.findOne({
      where: { id, tenantId },
      relations: [
        'productoFinal',
        'versiones',
        'versiones.ingredientes',
        'versiones.ingredientes.materiaPrima',
      ],
    });
  }

  /** Cálculo de kg por receta para un batch */
  async calcularNecesidades(
    tenantId: string,
    recetaId: string,
    cantidadKg: number,
  ) {
    const receta = await this.findOne(recetaId, tenantId);
    if (!receta) {
      throw new NotFoundException('Receta no encontrada');
    }
    const version = receta.versiones.find((v) => v.activa);

    if (!version) {
      throw new NotFoundException('Versión activa de la receta no encontrada');
    }

    return version.ingredientes.map((i) => ({
      materiaPrima: i.materiaPrima,
      porcentaje: i.porcentaje,
      kgNecesarios: (cantidadKg * i.porcentaje) / 100,
    }));
  }
}
