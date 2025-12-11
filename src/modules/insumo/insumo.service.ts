import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Insumo } from './entities/insumo.entity';

@Injectable()
export class InsumoService {
  constructor(@InjectRepository(Insumo) private repo: Repository<Insumo>) {}

  findAll(tenantId: string) {
    return this.repo.find({ where: { tenantId } });
  }

  async findOne(id: string, tenantId: string) {
    const item = await this.repo.findOne({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Insumo no encontrado');
    return item;
  }

  create(tenantId: string, dto: any) {
    const insumo = this.repo.create({ ...dto, tenantId });
    return this.repo.save(insumo);
  }

  async update(id: string, tenantId: string, dto: any) {
    await this.findOne(id, tenantId);
    return this.repo.save({ id, tenantId, ...dto });
  }

  async delete(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.repo.delete(id);
    return { message: 'Insumo eliminado' };
  }
}
