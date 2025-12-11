import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoteMP } from './entities/lote-mp.entity';
import { LoteProductoFinal } from './entities/lote-producto-final.entity';

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
      relations: ['deposito'],
      order: { fechaProduccion: 'DESC' },
    });
  }
}
