import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { BuscarAuditoriaDto } from './dto/buscar-auditoria.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Auditoria } from './entities/auditoria.entity';
import { Repository } from 'typeorm';

@Controller('auditoria')
@UseGuards(AuthGuard)
export class AuditoriaController {
  constructor(
    private readonly auditoriaService: AuditoriaService,
    @InjectRepository(Auditoria)
    private readonly repo: Repository<Auditoria>,
  ) {}

  /** ============================
   * GET /auditoria
   * Listado con filtros
   ============================ */
  @Get()
  async buscar(@Req() req, @Query() q: BuscarAuditoriaDto) {
    const tenantId = req.tenantId;

    const qb = this.repo
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId })
      .orderBy('a.createdAt', 'DESC');

    if (q.usuarioId) {
      qb.andWhere('a.usuarioId = :usuarioId', { usuarioId: q.usuarioId });
    }

    if (q.accion) {
      qb.andWhere('a.accion ILIKE :accion', { accion: `%${q.accion}%` });
    }

    if (q.search) {
      qb.andWhere(`a.metadata::text ILIKE :search`, {
        search: `%${q.search}%`,
      });
    }

    if (q.fechaDesde) {
      qb.andWhere('a.createdAt >= :desde', { desde: q.fechaDesde });
    }

    if (q.fechaHasta) {
      qb.andWhere('a.createdAt <= :hasta', { hasta: q.fechaHasta });
    }

    const page = q.page ?? 1;
    const limit = q.limit ?? 20;

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      total,
      page,
      limit,
      data,
    };
  }

  /** ============================
   * GET /auditoria/:id
   * Detalle de auditoría
   ============================ */
  @Get(':id')
  async obtener(@Req() req, @Param('id') id: string) {
    const tenantId = req.tenantId;

    const registro = await this.repo.findOne({
      where: { id, tenantId },
    });

    if (!registro) {
      throw new NotFoundException('Registro de auditoría no encontrado');
    }

    return registro;
  }
}
