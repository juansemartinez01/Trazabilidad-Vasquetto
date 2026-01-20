import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfiguracionOperativa } from './entities/configuracion-operativa.entity';
import { StockMinimoMP } from './entities/stock-minimo-mp.entity';
import { MateriaPrima } from '../materia-prima/entities/materia-prima.entity';
import { StockMinimoPF } from './entities/stock-minimo-pf.entity';
import { ProductoFinal } from '../producto-final/entities/producto-final.entity';

@Injectable()
export class ConfiguracionService {
  constructor(
    @InjectRepository(ConfiguracionOperativa)
    private configRepo: Repository<ConfiguracionOperativa>,
    @InjectRepository(StockMinimoMP)
    private minMpRepo: Repository<StockMinimoMP>,
    @InjectRepository(MateriaPrima)
    private mpRepo: Repository<MateriaPrima>,

    // ✅ NUEVO PF
    @InjectRepository(StockMinimoPF)
    private minPfRepo: Repository<StockMinimoPF>,

    @InjectRepository(ProductoFinal)
    private pfRepo: Repository<ProductoFinal>,
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

  // =========================
  //   ✅ STOCK MINIMO PF
  // =========================
  async setStockMinimoPF(
    tenantId: string,
    productoFinalId: string,
    stockMinKg: number,
  ) {
    const pf = await this.pfRepo.findOne({
      where: { id: productoFinalId, tenantId },
    });
    if (!pf) throw new NotFoundException('Producto final no encontrado');

    let row = await this.minPfRepo.findOne({
      where: { tenantId, productoFinal: { id: productoFinalId } },
    });

    if (!row) {
      row = this.minPfRepo.create({ tenantId, productoFinal: pf, stockMinKg });
    } else {
      row.stockMinKg = stockMinKg as any;
    }

    return this.minPfRepo.save(row);
  }

  listarStockMinimoPF(tenantId: string) {
    return this.minPfRepo.find({ where: { tenantId } });
  }
}
