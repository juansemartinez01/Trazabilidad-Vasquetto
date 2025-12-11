import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Deposito } from './entities/deposito.entity';

@Injectable()
export class DepositoService {
  constructor(@InjectRepository(Deposito) private repo: Repository<Deposito>) {}

  findAll(tenantId: string) {
    return this.repo.find({ where: { tenantId } });
  }

  async findOne(id: string, tenantId: string) {
    const item = await this.repo.findOne({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Depósito no encontrado');
    return item;
  }

  create(tenantId: string, dto: any) {
    const dep = this.repo.create({ ...dto, tenantId });
    return this.repo.save(dep);
  }

  async update(id: string, tenantId: string, dto: any) {
    await this.findOne(id, tenantId);
    return this.repo.save({ id, tenantId, ...dto });
  }

  async delete(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.repo.delete(id);
    return { message: 'Depósito eliminado' };
  }
}
