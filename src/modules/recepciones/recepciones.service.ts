import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recepcion } from './entities/recepcion.entity';
import { LoteMP } from '../lotes/entities/lote-mp.entity';
import { MateriaPrima } from '../materia-prima/entities/materia-prima.entity';
import { Deposito } from '../deposito/entities/deposito.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';

@Injectable()
export class RecepcionesService {
  constructor(
    @InjectRepository(Recepcion) private recepcionRepo: Repository<Recepcion>,
    @InjectRepository(LoteMP) private loteRepo: Repository<LoteMP>,
    @InjectRepository(MateriaPrima) private mpRepo: Repository<MateriaPrima>,
    @InjectRepository(Deposito) private depRepo: Repository<Deposito>,
    private auditoria: AuditoriaService,
  ) {}

  async crear(tenantId: string, usuarioId: string, dto: any) {
    const recepcion = this.recepcionRepo.create({
      tenantId,
      numeroRemito: dto.numeroRemito,
      fechaRemito: dto.fechaRemito,
      transportista: dto.transportista,
      proveedor: { id: dto.proveedorId },
      documentos: dto.documentos,
    });

    await this.recepcionRepo.save(recepcion);

    // Crear lotes
    for (const item of dto.lotes) {
      const mp = await this.mpRepo.findOne({
        where: { id: item.materiaPrimaId, tenantId },
      });
      if (!mp) throw new NotFoundException('Materia prima no encontrada');

      const dep = await this.depRepo.findOne({
        where: { id: item.depositoId, tenantId },
      });
      if (!dep) throw new NotFoundException('Depósito no encontrado');

      // calcular fecha vencimiento
      const fechaElab = new Date(item.fechaElaboracion);
      const meses = item.mesesVencimiento ?? 24;
      const fechaVto = new Date(fechaElab);
      fechaVto.setMonth(fechaVto.getMonth() + meses);

      const lote = this.loteRepo.create({
        tenantId,
        recepcion,
        materiaPrima: mp,
        deposito: dep,
        codigoLote: item.codigoLote,
        fechaElaboracion: item.fechaElaboracion,
        fechaAnalisis: item.fechaAnalisis,
        fechaVencimiento: fechaVto,
        cantidadInicialKg: item.cantidadKg,
        cantidadActualKg: item.cantidadKg,
        analisis: item.analisis,
        documentos: item.documentos,
      });

      await this.loteRepo.save(lote);
    }

    // Auditoría
    await this.auditoria.registrar(tenantId, usuarioId, 'RECEPCION_CREADA', {
      remito: recepcion.numeroRemito,
    });

    return this.recepcionRepo.findOne({
      where: { id: recepcion.id },
      relations: ['lotes', 'lotes.materiaPrima', 'lotes.deposito'],
    });
  }

  findAll(tenantId: string) {
    return this.recepcionRepo.find({
      where: { tenantId },
      relations: ['proveedor', 'lotes'],
    });
  }
}
