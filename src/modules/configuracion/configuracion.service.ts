import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfiguracionOperativa } from './entities/configuracion-operativa.entity';
import { StockMinimoMP } from './entities/stock-minimo-mp.entity';
import { MateriaPrima } from '../materia-prima/entities/materia-prima.entity';

@Injectable()
export class ConfiguracionService {
  constructor(
    @InjectRepository(ConfiguracionOperativa)
    private configRepo: Repository<ConfiguracionOperativa>,
    @InjectRepository(StockMinimoMP)
    private minMpRepo: Repository<StockMinimoMP>,
    @InjectRepository(MateriaPrima)
    private mpRepo: Repository<MateriaPrima>,
  ) {}

  async getOperativa(tenantId: string) {
    let cfg = await this.configRepo.findOne({ where: { tenantId } });
    if (!cfg) {
      cfg = await this.configRepo.save(
        this.configRepo.create({ tenantId, diasProximoVencimiento: 30 }),
      );
    }
    return cfg;
  }

  async setOperativa(tenantId: string, patch: Partial<ConfiguracionOperativa>) {
    const cfg = await this.getOperativa(tenantId);
    Object.assign(cfg, patch);
    return this.configRepo.save(cfg);
  }

  async setStockMinimoMP(
    tenantId: string,
    materiaPrimaId: string,
    stockMinKg: number,
  ) {
    const mp = await this.mpRepo.findOne({
      where: { id: materiaPrimaId, tenantId },
    });
    if (!mp) throw new NotFoundException('Materia prima no encontrada');

    // upsert manual (sin depender de features)
    let row = await this.minMpRepo.findOne({
      where: { tenantId, materiaPrima: { id: materiaPrimaId } },
    });

    if (!row) {
      row = this.minMpRepo.create({ tenantId, materiaPrima: mp, stockMinKg });
    } else {
      row.stockMinKg = stockMinKg as any;
    }

    return this.minMpRepo.save(row);
  }

  listarStockMinimoMP(tenantId: string) {
    return this.minMpRepo.find({ where: { tenantId } });
  }
}
