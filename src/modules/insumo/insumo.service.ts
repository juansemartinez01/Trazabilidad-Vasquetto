import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Insumo } from './entities/insumo.entity';
import { CreateInsumoDto } from './dto/create-insumo.dto';
import { UpdateInsumoDto } from './dto/update-insumo.dto';
import { InsumoMovimiento, TipoMovimientoInsumo } from './entities/insumo-movimiento.entity';
import { AjusteStockDto, MovimientoStockDto } from './dto/movimiento-stock.dto';

@Injectable()
export class InsumoService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(Insumo) private repo: Repository<Insumo>,
    @InjectRepository(InsumoMovimiento)
    private movRepo: Repository<InsumoMovimiento>,
  ) {}

  findAll(tenantId: string) {
    return this.repo.find({
      where: { tenantId },
      order: { nombre: 'ASC' },
    });
  }

  async insumosBajoMinimo(tenantId: string) {
    // Solo los que tienen stockMinimo definido y > 0, y stockActual < stockMinimo
    const rows = await this.repo
      .createQueryBuilder('i')
      .select([
        'i.id AS "insumoId"',
        'i.nombre AS "nombre"',
        'i.unidad AS "unidad"',
        'COALESCE(i.stockActual, 0) AS "stockActual"',
        'COALESCE(i.stockMinimo, 0) AS "stockMinimo"',
        '(COALESCE(i.stockMinimo, 0) - COALESCE(i.stockActual, 0)) AS "faltante"',
      ])
      .where('i.tenant_id = :tenantId', { tenantId })
      .andWhere('i.stockMinimo IS NOT NULL')
      .andWhere('COALESCE(i.stockMinimo, 0) > 0')
      .andWhere('COALESCE(i.stockActual, 0) < COALESCE(i.stockMinimo, 0)')
      .orderBy('"faltante"', 'DESC')
      .getRawMany<{
        insumoId: string;
        nombre: string;
        unidad: string;
        stockActual: string;
        stockMinimo: string;
        faltante: string;
      }>();

    // Normalizar a number
    return rows.map((r) => ({
      insumoId: r.insumoId,
      nombre: r.nombre,
      unidad: r.unidad,
      stockActual: Number(r.stockActual ?? 0),
      stockMinimo: Number(r.stockMinimo ?? 0),
      faltante: Math.max(0, Number(r.faltante ?? 0)),
    }));
  }

  async findOne(id: string, tenantId: string) {
    const item = await this.repo.findOne({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Insumo no encontrado');
    return item;
  }

  async create(tenantId: string, dto: CreateInsumoDto) {
    // 🔒 stockActual siempre lo maneja el sistema
    const insumo = this.repo.create({
      tenantId,
      nombre: dto.nombre,
      unidad: dto.unidad,
      stockMinimo: dto.stockMinimo ?? undefined,
      stockActual: 0,
    });

    return this.repo.save(insumo);
  }

  async update(id: string, tenantId: string, dto: UpdateInsumoDto) {
    const actual = await this.findOne(id, tenantId);

    // 🔒 nunca permitir actualizar stockActual desde este endpoint
    const next = this.repo.merge(actual, {
      ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
      ...(dto.unidad !== undefined ? { unidad: dto.unidad } : {}),
      ...(dto.stockMinimo !== undefined
        ? { stockMinimo: dto.stockMinimo }
        : {}),
    });

    return this.repo.save(next);
  }

  async delete(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    // ✅ borra solo si coincide tenantId (no usar repo.delete(id) a secas)
    const res = await this.repo.delete({ id, tenantId });

    if (!res.affected) throw new NotFoundException('Insumo no encontrado');

    return { message: 'Insumo eliminado' };
  }

  // ---------------------------
  // Movimientos de stock
  // ---------------------------

  async listarMovimientos(tenantId: string, insumoId: string) {
    // simple: últimos 200
    return this.movRepo.find({
      where: { tenantId, insumoId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async ingresoStock(
    tenantId: string,
    insumoId: string,
    dto: MovimientoStockDto,
  ) {
    return this.aplicarMovimiento(tenantId, insumoId, {
      tipo: TipoMovimientoInsumo.INGRESO,
      delta: +Math.abs(Number(dto.cantidad)),
      motivo: dto.motivo,
      referenciaId: dto.referenciaId,
      responsableId: dto.responsableId,
    });
  }

  async egresoStock(
    tenantId: string,
    insumoId: string,
    dto: MovimientoStockDto,
  ) {
    return this.aplicarMovimiento(tenantId, insumoId, {
      tipo: TipoMovimientoInsumo.EGRESO,
      delta: -Math.abs(Number(dto.cantidad)),
      motivo: dto.motivo,
      referenciaId: dto.referenciaId,
      responsableId: dto.responsableId,
    });
  }

  async mermaStock(
    tenantId: string,
    insumoId: string,
    dto: MovimientoStockDto,
  ) {
    return this.aplicarMovimiento(tenantId, insumoId, {
      tipo: TipoMovimientoInsumo.MERMA,
      delta: -Math.abs(Number(dto.cantidad)),
      motivo: dto.motivo ?? 'MERMA',
      referenciaId: dto.referenciaId,
      responsableId: dto.responsableId,
    });
  }

  async ajustarStock(tenantId: string, insumoId: string, dto: AjusteStockDto) {
    const delta = Number(dto.cantidadAjuste);
    if (!Number.isFinite(delta) || delta === 0) {
      throw new BadRequestException(
        'cantidadAjuste debe ser numérico y distinto de 0',
      );
    }

    return this.aplicarMovimiento(tenantId, insumoId, {
      tipo: TipoMovimientoInsumo.AJUSTE,
      delta,
      motivo: dto.motivo,
      referenciaId: dto.referenciaId,
      responsableId: dto.responsableId,
    });
  }

  private async aplicarMovimiento(
    tenantId: string,
    insumoId: string,
    data: {
      tipo: TipoMovimientoInsumo;
      delta: number; // + o -
      motivo?: string;
      referenciaId?: string;
      responsableId?: string;
    },
  ) {
    return this.ds.transaction(async (manager) => {
      // lock pesimista para evitar race conditions
      const insumo = await manager.getRepository(Insumo).findOne({
        where: { id: insumoId, tenantId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!insumo) throw new NotFoundException('Insumo no encontrado');

      const actual = Number(insumo.stockActual ?? 0);
      const nuevo = actual + Number(data.delta);

      if (nuevo < 0) {
        throw new BadRequestException(
          `Stock insuficiente (actual ${actual}, ajuste ${data.delta})`,
        );
      }

      insumo.stockActual = nuevo;
      await manager.getRepository(Insumo).save(insumo);

      const mov = manager.getRepository(InsumoMovimiento).create({
        tenantId,
        insumo,
        insumoId: insumo.id,
        tipo: data.tipo,
        cantidad: data.delta, // se guarda el delta (positivo/negativo)
        motivo: data.motivo,
        referenciaId: data.referenciaId,
        responsableId: data.responsableId,
      });

      await manager.getRepository(InsumoMovimiento).save(mov);

      return {
        insumo,
        movimiento: mov,
      };
    });
  }
}
