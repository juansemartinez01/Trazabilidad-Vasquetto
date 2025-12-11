import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Auditoria } from './entities/auditoria.entity';
import { Repository } from 'typeorm';

@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(Auditoria)
    private repo: Repository<Auditoria>,
  ) {}

  async registrar(
    tenantId: string,
    usuarioId: string,
    accion: string,
    metadata?: any,
  ) {
    const registro = this.repo.create({
      tenantId,
      usuarioId,
      accion,
      metadata,
    });

    await this.repo.save(registro);
  }
}
