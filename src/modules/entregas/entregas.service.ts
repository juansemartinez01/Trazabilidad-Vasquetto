import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entrega } from './entities/entrega.entity';
import { EntregaItem } from './entities/entrega-item.entity';
import { Cliente } from '../clientes/entities/cliente.entity';
import { LotePfEstado, LoteProductoFinal } from '../lotes/entities/lote-producto-final.entity';
import { Deposito } from '../deposito/entities/deposito.entity';
import { StockService } from '../stock-movimiento/stock.service';
import { TipoMovimiento } from '../stock-movimiento/entities/stock-movimiento.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';

@Injectable()
export class EntregasService {
  constructor(
    @InjectRepository(Entrega) private entregaRepo: Repository<Entrega>,
    @InjectRepository(EntregaItem) private itemRepo: Repository<EntregaItem>,
    @InjectRepository(Cliente) private clienteRepo: Repository<Cliente>,
    @InjectRepository(LoteProductoFinal)
    private loteRepo: Repository<LoteProductoFinal>,
    @InjectRepository(Deposito) private depRepo: Repository<Deposito>,
    private stockService: StockService,
    private auditoria: AuditoriaService,
  ) {}

  /** ============================
   *  CREAR ENTREGA
   ============================ */
  async crear(tenantId: string, usuarioId: string, dto: any) {
    const cliente = await this.clienteRepo.findOne({
      where: { id: dto.clienteId, tenantId },
    });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');

    const entrega = this.entregaRepo.create({
      tenantId,
      cliente,
      numeroRemito: dto.numeroRemito,
      fecha: dto.fecha,
      chofer: { id: dto.choferId },
      observaciones: dto.observaciones,
    });

    await this.entregaRepo.save(entrega);

    for (const item of dto.items) {
  const lote = await this.loteRepo.findOne({
    where: { id: item.loteId, tenantId },
  });
  if (!lote) throw new NotFoundException('Lote no encontrado');

  // 1) Si está vencido => setear VENCIDO y bloquear
  if (lote.fechaVencimiento) {
    const hoy = new Date();
    const vencimiento = new Date(lote.fechaVencimiento);
    hoy.setHours(0, 0, 0, 0);
    vencimiento.setHours(0, 0, 0, 0);

    if (vencimiento < hoy) {
      if (lote.estado !== LotePfEstado.VENCIDO) {
        lote.estado = LotePfEstado.VENCIDO;
        lote.motivoEstado = 'Vencido al intentar entregar';
        lote.fechaEstado = new Date();
        await this.loteRepo.save(lote);
      }
      throw new BadRequestException(`El lote ${lote.codigoLote} está vencido`);
    }
  }

  // 2) Solo se entrega si está LISTO
  if (lote.estado !== LotePfEstado.LISTO) {
    throw new BadRequestException(
      `El lote ${lote.codigoLote} no está LISTO (estado actual: ${lote.estado})`,
    );
  }

  // 3) Validar stock
  if (Number(lote.cantidadActualKg) < Number(item.cantidadKg)) {
    throw new BadRequestException(`Stock insuficiente en lote ${lote.codigoLote}`);
  }

  const deposito = await this.depRepo.findOne({
    where: { id: item.depositoId, tenantId },
  });
  if (!deposito) throw new NotFoundException('Depósito no encontrado');

  // 4) Descontar stock (✅ UNA SOLA VEZ)
  const loteActualizado = await this.stockService.consumirLotePF(
    tenantId,
    lote.id,
    item.cantidadKg,
    TipoMovimiento.ENTREGA,
    entrega.id,
  );

  // 5) Crear item (tenantId ✅)
  const entregaItem = this.itemRepo.create({
    tenantId,
    entrega,
    lote,
    deposito,
    cantidadKg: item.cantidadKg,
    cantidadBultos: item.cantidadBultos,
  });
  await this.itemRepo.save(entregaItem);

  // 6) Si quedó en 0 => ENTREGADO
  if (Number(loteActualizado.cantidadActualKg) <= 0) {
    loteActualizado.estado = LotePfEstado.ENTREGADO;
    loteActualizado.motivoEstado = `Entregado (remito ${dto.numeroRemito})`;
    loteActualizado.fechaEstado = new Date();
    await this.loteRepo.save(loteActualizado);
  }
}

    await this.auditoria.registrar(tenantId, usuarioId, 'ENTREGA_CREADA', {
      entregaId: entrega.id,
    });

    return this.obtener(tenantId, entrega.id);
  }

  /** ============================
   *  OBTENER ENTREGA COMPLETA
   ============================ */
  obtener(tenantId: string, id: string) {
    return this.entregaRepo.findOne({
      where: { id, tenantId },
      relations: ['cliente', 'items', 'items.lote', 'items.deposito'],
    });
  }

  /** ============================
   *  LISTAR ENTREGAS
   ============================ */
  listar(tenantId: string) {
    return this.entregaRepo.find({
      where: { tenantId },
      relations: ['cliente'],
    });
  }

  /** ============================
   *  HISTORIAL POR CLIENTE
   ============================ */
  async historialPorCliente(tenantId: string, clienteId: string) {
    return this.entregaRepo.find({
      where: { tenantId, cliente: { id: clienteId } },
      relations: ['items', 'items.lote'],
    });
  }

  /** ============================
   *  TRAZABILIDAD FORWARD
   ============================ */
  async trazabilidadForwardLote(tenantId: string, loteId: string) {
    return this.itemRepo.find({
      where: { tenantId, lote: { id: loteId } },
      relations: ['entrega', 'entrega.cliente'],
    });
  }
}
