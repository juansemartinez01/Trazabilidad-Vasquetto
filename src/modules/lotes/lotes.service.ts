import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoteMP } from './entities/lote-mp.entity';
import { LotePfEstado, LoteProductoFinal } from './entities/lote-producto-final.entity';
import { CambiarEstadoLotePfDto } from './dto/cambiar-estado-lote-pf.dto';

@Injectable()
export class LotesService {
  constructor(
    @InjectRepository(LoteMP)
    private loteMpRepo: Repository<LoteMP>,

    @InjectRepository(LoteProductoFinal)
    private lotePfRepo: Repository<LoteProductoFinal>,
  ) {}

  /** LOTES DE MATERIA PRIMA */
  listarLotesMP(tenantId: string) {
    return this.loteMpRepo.find({
      where: { tenantId },
      relations: ['materiaPrima', 'deposito'],
      order: { fechaVencimiento: 'ASC' },
    });
  }

  /** LOTES DE PRODUCTO FINAL */
  listarLotesPF(tenantId: string) {
    return this.lotePfRepo.find({
      where: { tenantId },
      relations: ['deposito', 'productoFinal'],
      order: { fechaProduccion: 'DESC' },
    });
  }

  async cambiarEstadoPF(
    tenantId: string,
    loteId: string,
    dto: CambiarEstadoLotePfDto,
  ) {
    const lote = await this.lotePfRepo.findOne({
      where: { id: loteId, tenantId },
    });
    if (!lote) throw new NotFoundException('Lote PF no encontrado');

    // Reglas simples para evitar incoherencias
    if (lote.estado === LotePfEstado.ENTREGADO) {
      throw new BadRequestException(
        'El lote ya está ENTREGADO y no puede cambiar de estado',
      );
    }
    if (
      lote.estado === LotePfEstado.DESCARTADO &&
      dto.estado !== LotePfEstado.DESCARTADO
    ) {
      throw new BadRequestException(
        'Un lote DESCARTADO no puede volver a otro estado',
      );
    }

    lote.estado = dto.estado;
    lote.motivoEstado = dto.motivoEstado ?? null;
    lote.fechaEstado = new Date();

    return this.lotePfRepo.save(lote);
  }
}
