import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MateriaPrima } from './entities/materia-prima.entity';
import { Repository } from 'typeorm';

@Injectable()
export class MateriaPrimaService {
  constructor(
    @InjectRepository(MateriaPrima)
    private repo: Repository<MateriaPrima>,
  ) {}

  findAll(tenantId: string) {
    return this.repo.find({ where: { tenantId } });
  }

  async findOne(id: string, tenantId: string) {
    const mp = await this.repo.findOne({ where: { id, tenantId } });
    if (!mp) throw new NotFoundException('Materia prima no encontrada');
    return mp;
  }

  create(tenantId: string, dto: any) {
    const mp = this.repo.create({
      ...dto,
      tenantId,
    });
    return this.repo.save(mp);
  }

  async update(id: string, tenantId: string, dto: any) {
    await this.findOne(id, tenantId);
    return this.repo.save({ id, tenantId, ...dto });
  }

  async delete(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.repo.delete(id);
    return { message: 'Materia prima eliminada' };
  }
}
