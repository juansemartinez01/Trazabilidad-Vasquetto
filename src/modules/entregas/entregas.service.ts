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
import { PresentacionProductoFinal, UnidadVenta } from '../producto-final/entities/presentacion-producto-final.entity';

@Injectable()
export class EntregasService {
  constructor(
    @InjectRepository(Entrega) private entregaRepo: Repository<Entrega>,
    @InjectRepository(EntregaItem) private itemRepo: Repository<EntregaItem>,
    @InjectRepository(Cliente) private clienteRepo: Repository<Cliente>,
    @InjectRepository(LoteProductoFinal)
    private loteRepo: Repository<LoteProductoFinal>,
    @InjectRepository(Deposito) private depRepo: Repository<Deposito>,

    @InjectRepository(PresentacionProductoFinal)
    private presRepo: Repository<PresentacionProductoFinal>,
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
        relations: ['productoFinal'], // ✅ importante
      });
      if (!lote) throw new NotFoundException('Lote no encontrado');

      // 1) Validación vencimiento + estado LISTO (tu lógica está OK)
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
          throw new BadRequestException(
            `El lote ${lote.codigoLote} está vencido`,
          );
        }
      }

      if (lote.estado !== LotePfEstado.LISTO) {
        throw new BadRequestException(
          `El lote ${lote.codigoLote} no está LISTO (estado actual: ${lote.estado})`,
        );
      }

      // 2) Depósito
      const deposito = await this.depRepo.findOne({
        where: { id: item.depositoId, tenantId },
      });
      if (!deposito) throw new NotFoundException('Depósito no encontrado');

      // 3) Presentación (opcional)
      let presentacion: PresentacionProductoFinal | null = null;

      if (item.presentacionId) {
        presentacion = await this.presRepo.findOne({
          where: { id: item.presentacionId, tenantId },
          relations: ['productoFinal'],
        });
        if (!presentacion)
          throw new NotFoundException('Presentación no encontrada');

        // ✅ coherencia: presentación pertenece al PF del lote
        const pfLoteId = lote.productoFinal?.id;
        const pfPresId = presentacion.productoFinal?.id;

        if (!pfLoteId) {
          throw new BadRequestException(
            `El lote ${lote.codigoLote} no tiene ProductoFinal asociado`,
          );
        }
        if (pfPresId !== pfLoteId) {
          throw new BadRequestException(
            `La presentación ${presentacion.codigo} no pertenece al ProductoFinal del lote ${lote.codigoLote}`,
          );
        }
      }

      // 4) Calcular kg a descontar
      let kgADescontar: number;

      if (!presentacion) {
        // modo legacy: exige cantidadKg
        if (item.cantidadKg == null) {
          throw new BadRequestException(
            'cantidadKg es requerida si no se envía presentacionId',
          );
        }
        kgADescontar = Number(item.cantidadKg);
      } else {
        if (presentacion.unidadVenta === UnidadVenta.KG) {
          if (item.cantidadKg == null) {
            throw new BadRequestException(
              `cantidadKg es requerida para la presentación ${presentacion.codigo} (unidad KG)`,
            );
          }
          kgADescontar = Number(item.cantidadKg);
        } else {
          const bultos = Number(item.cantidadBultos ?? 0);
          const peso = Number(presentacion.pesoPorUnidadKg ?? 0);

          if (!bultos || bultos <= 0) {
            throw new BadRequestException(
              `cantidadBultos es requerida para la presentación ${presentacion.codigo}`,
            );
          }
          if (!peso || peso <= 0) {
            throw new BadRequestException(
              `La presentación ${presentacion.codigo} no tiene pesoPorUnidadKg configurado`,
            );
          }

          kgADescontar = bultos * peso;
        }
      }

      if (kgADescontar <= 0) {
        throw new BadRequestException('La cantidad a descontar debe ser > 0');
      }

      // 5) Validar stock
      if (Number(lote.cantidadActualKg) < kgADescontar) {
        throw new BadRequestException(
          `Stock insuficiente en lote ${lote.codigoLote} (disponible ${lote.cantidadActualKg}, requerido ${kgADescontar})`,
        );
      }

      // 6) Descontar stock
      const loteActualizado = await this.stockService.consumirLotePF(
        tenantId,
        lote.id,
        kgADescontar,
        TipoMovimiento.ENTREGA,
        entrega.id,
      );

      // 7) Crear item (guardamos presentación + kg ya normalizados)
      const entregaItem = this.itemRepo.create({
        tenantId,
        entrega,
        lote,
        deposito,
        presentacion, // ✅
        cantidadKg: kgADescontar,
        cantidadBultos: Number(item.cantidadBultos ?? 0), // legacy o calculado
      });
      await this.itemRepo.save(entregaItem);

      // 8) Si quedó 0 => ENTREGADO
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
