import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

  async create(tenantId: string, dto: any) {
    if (dto.nombre) {
      const existente = await this.repo.findOne({
        where: { tenantId, nombre: dto.nombre },
      });

      if (existente) {
        throw new BadRequestException(
          `Ya existe una materia prima con el nombre "${dto.nombre}"`,
        );
      }
    }

    const mp = this.repo.create({
      ...dto,
      tenantId,
    });
    return this.repo.save(mp);
  }

  async update(id: string, tenantId: string, dto: any) {
    const mp = await this.findOne(id, tenantId);

    // Si me quieren cambiar el nombre, valido que no exista otra MP con ese nombre
    if (dto.nombre && dto.nombre !== mp.nombre) {
      const existente = await this.repo.findOne({
        where: { tenantId, nombre: dto.nombre },
      });

      if (existente) {
        throw new BadRequestException(
          `Ya existe una materia prima con el nombre "${dto.nombre}"`,
        );
      }
    }

    Object.assign(mp, dto);
    return this.repo.save(mp);
  }

  async delete(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.repo.delete(id);
    return { message: 'Materia prima eliminada' };
  }
}
