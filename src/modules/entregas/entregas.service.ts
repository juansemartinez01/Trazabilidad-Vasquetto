import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Entrega } from './entities/entrega.entity';
import { EntregaItem } from './entities/entrega-item.entity';
import { Cliente } from '../clientes/entities/cliente.entity';
import {
  LotePfEstado,
  LoteProductoFinal,
} from '../lotes/entities/lote-producto-final.entity';
import { Deposito } from '../deposito/entities/deposito.entity';
import { StockService } from '../stock-movimiento/stock.service';
import {
  StockMovimiento,
  TipoMovimiento,
} from '../stock-movimiento/entities/stock-movimiento.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';
import {
  PresentacionProductoFinal,
  UnidadVenta,
} from '../producto-final/entities/presentacion-producto-final.entity';

// ✅ NUEVO
import { StockPresentacion } from '../empaques/entities/stock-presentacion.entity';
import { PFUnidadEnvasada } from '../empaques/entities/pf-unidad-envasada.entity';

function dec(n: any) {
  const v = Number(n);
  if (Number.isNaN(v)) return 0;
  return v;
}

@Injectable()
export class EntregasService {
  constructor(
    private ds: DataSource,

    @InjectRepository(Entrega) private entregaRepo: Repository<Entrega>,
    @InjectRepository(EntregaItem) private itemRepo: Repository<EntregaItem>,
    @InjectRepository(Cliente) private clienteRepo: Repository<Cliente>,
    @InjectRepository(LoteProductoFinal)
    private loteRepo: Repository<LoteProductoFinal>,
    @InjectRepository(Deposito) private depRepo: Repository<Deposito>,
    @InjectRepository(PresentacionProductoFinal)
    private presRepo: Repository<PresentacionProductoFinal>,
    @InjectRepository(StockMovimiento)
    private movRepo: Repository<StockMovimiento>,

    // ✅ NUEVO
    @InjectRepository(StockPresentacion)
    private stockPresRepo: Repository<StockPresentacion>,
    @InjectRepository(PFUnidadEnvasada)
    private unidadRepo: Repository<PFUnidadEnvasada>,

    private stockService: StockService,
    private auditoria: AuditoriaService,
  ) {}

  /** ============================
   *  CREAR ENTREGA
   ============================ */
  async crear(tenantId: string, usuarioId: string, dto: any) {
    return this.ds.transaction(async (trx) => {
      const entregaRepo = trx.getRepository(Entrega);
      const itemRepo = trx.getRepository(EntregaItem);
      const clienteRepo = trx.getRepository(Cliente);
      const loteRepo = trx.getRepository(LoteProductoFinal);
      const depRepo = trx.getRepository(Deposito);
      const presRepo = trx.getRepository(PresentacionProductoFinal);
      const unidadRepo = trx.getRepository(PFUnidadEnvasada);
      const movRepo = trx.getRepository(StockMovimiento);

      const cliente = await clienteRepo.findOne({
        where: { id: dto.clienteId, tenantId },
      });
      if (!cliente) throw new NotFoundException('Cliente no encontrado');

      const entrega = entregaRepo.create({
        tenantId,
        cliente,
        numeroRemito: dto.numeroRemito,
        fecha: dto.fecha,
        chofer: { id: dto.choferId },
        observaciones: dto.observaciones,
      });
      await entregaRepo.save(entrega);

      for (const item of dto.items) {
        const deposito = await depRepo.findOne({
          where: { id: item.depositoId, tenantId },
        });
        if (!deposito) throw new NotFoundException('Depósito no encontrado');

        // ============================
        // 1) Resolver presentación (si viene)
        // ============================
        let presentacion: PresentacionProductoFinal | null = null;
        if (item.presentacionId) {
          presentacion = await presRepo.findOne({
            where: { id: item.presentacionId, tenantId },
            relations: ['productoFinal'],
          });
          if (!presentacion)
            throw new NotFoundException('Presentación no encontrada');
        }

        // ============================
        // 2) CASO: PRESENTACIÓN KG => SE TRATA COMO GRANEL (FEFO LOTE PF)
        // ============================
        const esPresKg =
          !!presentacion && presentacion.unidadVenta === UnidadVenta.KG;

        // ============================
        // 3) CASO GRANEL (sin pres) O (pres KG)
        // ============================
        if (!presentacion || esPresKg) {
          const kg = Number(item.cantidadKg ?? 0);
          if (!Number.isFinite(kg) || kg <= 0) {
            throw new BadRequestException(
              'cantidadKg es requerida y debe ser > 0',
            );
          }

          // objetivo PF: por item.productoFinalId, o por presentacion.productoFinal.id, o modo manual loteId
          let productoFinalId: string | null = item.productoFinalId ?? null;
          if (!productoFinalId && presentacion?.productoFinal?.id)
            productoFinalId = presentacion.productoFinal.id;

          // Modo manual: si mandan loteId, consumimos ese lote directamente
          if (item.loteId) {
            const lote = await loteRepo.findOne({
              where: { id: item.loteId, tenantId },
              relations: ['productoFinal', 'deposito'],
            });
            if (!lote) throw new NotFoundException('Lote no encontrado');

            // validación estado/vencimiento como la tuya
            await this.validarLoteEntregable(
              trx,
              tenantId,
              lote,
              dto.numeroRemito,
            );

            if (Number(lote.cantidadActualKg) < kg) {
              throw new BadRequestException(
                `Stock insuficiente en lote ${lote.codigoLote} (disp ${lote.cantidadActualKg}, req ${kg})`,
              );
            }

            const loteActualizado = await this.stockService.consumirLotePF(
              tenantId,
              lote.id,
              kg,
              TipoMovimiento.ENTREGA,
              entrega.id,
            );

            await itemRepo.save(
              itemRepo.create({
                tenantId,
                entrega,
                lote,
                deposito,
                presentacion: presentacion ?? null, // si era pres KG, dejamos trazado el SKU vendido
                cantidadKg: kg,
                cantidadBultos: Number(item.cantidadBultos ?? 0),
              }),
            );

            if (Number(loteActualizado.cantidadActualKg) <= 0) {
              loteActualizado.estado = LotePfEstado.ENTREGADO;
              loteActualizado.motivoEstado = `Entregado (remito ${dto.numeroRemito})`;
              loteActualizado.fechaEstado = new Date();
              await loteRepo.save(loteActualizado);
            }

            continue;
          }

          if (!productoFinalId) {
            throw new BadRequestException(
              'Para entrega granel FEFO debe venir productoFinalId (o loteId)',
            );
          }

          // ✅ FEFO automático por PF
          const plan = await this.planConsumoGranelFEFO(
            trx,
            tenantId,
            productoFinalId,
            kg,
          );

          for (const p of plan) {
            await this.validarLoteEntregable(
              trx,
              tenantId,
              p.lote,
              dto.numeroRemito,
            );

            const loteActualizado = await this.stockService.consumirLotePF(
              tenantId,
              p.lote.id,
              p.kg,
              TipoMovimiento.ENTREGA,
              entrega.id,
            );

            await itemRepo.save(
              itemRepo.create({
                tenantId,
                entrega,
                lote: p.lote,
                deposito,
                presentacion: presentacion ?? null, // ✅ si era pres KG, queda asociado
                cantidadKg: p.kg,
                cantidadBultos: 0,
              }),
            );

            if (Number(loteActualizado.cantidadActualKg) <= 0) {
              loteActualizado.estado = LotePfEstado.ENTREGADO;
              loteActualizado.motivoEstado = `Entregado (remito ${dto.numeroRemito})`;
              loteActualizado.fechaEstado = new Date();
              await loteRepo.save(loteActualizado);
            }
          }

          continue;
        }

        // ============================
        // 4) CASO ENVASADO (BULTO/UNIDAD) => FEFO por unidades envasadas
        // ============================
        const bultos = Number(item.cantidadBultos ?? 0);
        if (!Number.isFinite(bultos) || bultos <= 0) {
          throw new BadRequestException(
            `cantidadBultos es requerida para ${presentacion.codigo}`,
          );
        }

        const peso = Number(presentacion.pesoPorUnidadKg ?? 0);
        if (!peso || peso <= 0) {
          throw new BadRequestException(
            `Presentación ${presentacion.codigo} requiere pesoPorUnidadKg`,
          );
        }

        // Seleccionar unidades FEFO
        const unidades = await this.seleccionarUnidadesFEFOConLock(
          trx,
          tenantId,
          presentacion.id,
          deposito.id,
          bultos,
        );

        // Marcar ENTREGADO
        for (const u of unidades) u.estado = 'ENTREGADO' as any;
        await unidadRepo.save(unidades);

        // Agrupar por loteOrigen para trazabilidad perfecta
        const mapPorLote = new Map<string, PFUnidadEnvasada[]>();
        for (const u of unidades) {
          const loteId = (u.loteOrigen as any)?.id;
          if (!loteId) {
            throw new BadRequestException(
              'Unidad envasada sin loteOrigen (inconsistencia)',
            );
          }
          if (!mapPorLote.has(loteId)) mapPorLote.set(loteId, []);
          mapPorLote.get(loteId)!.push(u);
        }

        for (const [loteId, units] of mapPorLote.entries()) {
          const lote = await loteRepo.findOne({
            where: { id: loteId, tenantId },
            relations: ['productoFinal', 'deposito'],
          });
          if (!lote) throw new NotFoundException('Lote origen no encontrado');

          // validación estado/vencimiento (misma que granel)
          await this.validarLoteNoVencido(
            trx,
            tenantId,
            lote
          );

          const cant = units.length;
          const kg = cant * peso;

          // Movimiento (referencia entrega) — trazabilidad hacia loteOrigen
          await movRepo.save(
            movRepo.create({
              tenantId,
              tipo: TipoMovimiento.ENTREGA,
              lotePF: lote,
              deposito,
              presentacion,
              cantidadKg: -kg,
              cantidadUnidades: cant,
              referenciaId: entrega.id,
            }),
          );

          // Crear item (uno por lote origen)
          await itemRepo.save(
            itemRepo.create({
              tenantId,
              entrega,
              lote,
              deposito,
              presentacion,
              cantidadKg: kg,
              cantidadBultos: cant,
            }),
          );
        }
      }

      await this.auditoria.registrar(tenantId, usuarioId, 'ENTREGA_CREADA', {
        entregaId: entrega.id,
      });

      return this.obtener(tenantId, entrega.id);
    });
  }

  private async validarLoteEntregable(
    trx: any,
    tenantId: string,
    lote: LoteProductoFinal,
    numeroRemito: string,
  ) {
    const loteRepo = trx.getRepository(LoteProductoFinal);

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
          await loteRepo.save(lote);
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
  }

  /** ============================
   *  OBTENER ENTREGA COMPLETA
   ============================ */
  obtener(tenantId: string, id: string) {
    return this.entregaRepo.findOne({
      where: { id, tenantId },
      relations: [
        'cliente',
        'items',
        'items.lote',
        'items.deposito',
        'items.presentacion', // ✅
      ],
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
      relations: ['items', 'items.lote', 'items.presentacion'],
    });
  }

  /** ============================
   *  TRAZABILIDAD FORWARD
   ============================ */
  async trazabilidadForwardLote(tenantId: string, loteId: string) {
    return this.itemRepo.find({
      where: { tenantId, lote: { id: loteId } },
      relations: ['entrega', 'entrega.cliente', 'presentacion'],
    });
  }

  private async seleccionarUnidadesFEFOConLock(
    trx: any,
    tenantId: string,
    presentacionId: string,
    depositoId: string,
    bultos: number,
  ) {
    const unidadRepo = trx.getRepository(PFUnidadEnvasada);

    // ✅ lock pesimista (evita que otra transacción tome las mismas unidades)
    const unidades = await unidadRepo
      .createQueryBuilder('u')
      .setLock('pessimistic_write')
      .innerJoinAndSelect('u.loteOrigen', 'l')
      .where('u.tenant_id = :tenantId', { tenantId })
      .andWhere('u.presentacion_id = :presentacionId', { presentacionId }) // ✅ usa la FK real
      .andWhere('u.deposito_id = :depositoId', { depositoId }) // ✅ usa la FK real
      .andWhere('u.estado = :estado', { estado: 'DISPONIBLE' })
      .orderBy('l.fechaVencimiento', 'ASC', 'NULLS LAST')
      .addOrderBy('l.fechaProduccion', 'ASC')
      .addOrderBy('u.createdAt', 'ASC')

      .take(bultos)
      .getMany();

    if (unidades.length < bultos) {
      throw new BadRequestException(
        `Stock insuficiente de unidades envasadas (requerido ${bultos}, disponible ${unidades.length})`,
      );
    }

    return unidades;
  }

  private async planConsumoGranelFEFO(
    trx: any,
    tenantId: string,
    productoFinalId: string,
    kgRequeridos: number,
  ) {
    const loteRepo = trx.getRepository(LoteProductoFinal);

    const lotes = await loteRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.productoFinal', 'pf')
      .leftJoinAndSelect('l.deposito', 'dep')
      .where('l.tenant_id = :tenantId', { tenantId })
      .andWhere('pf.id = :pfId', { pfId: productoFinalId })
      .andWhere('l.estado = :estado', { estado: LotePfEstado.LISTO })
      .andWhere('COALESCE(l.cantidad_actual_kg, 0) > 0')
      .orderBy('l.fecha_vencimiento', 'ASC', 'NULLS LAST')
      .addOrderBy('l.fecha_produccion', 'ASC')
      .addOrderBy('l.created_at', 'ASC')
      .getMany();

    let restante = kgRequeridos;
    const plan: Array<{ lote: LoteProductoFinal; kg: number }> = [];

    for (const lote of lotes) {
      if (restante <= 0) break;
      const disp = Number(lote.cantidadActualKg ?? 0);
      if (disp <= 0) continue;

      const usar = Math.min(disp, restante);
      plan.push({ lote, kg: usar });
      restante -= usar;
    }

    if (restante > 0) {
      throw new BadRequestException(
        `Stock insuficiente FEFO para PF ${productoFinalId} (faltan ${restante} kg)`,
      );
    }

    return plan;
  }

  private async seleccionarUnidadesFEFO(
    trx: any,
    tenantId: string,
    presentacionId: string,
    depositoId: string,
    bultos: number,
  ) {
    const unidadRepo = trx.getRepository(PFUnidadEnvasada);

    // Traemos más info: loteOrigen para ordenar FEFO
    const unidades = await unidadRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.loteOrigen', 'l')
      .leftJoinAndSelect('u.presentacion', 'p')
      .leftJoinAndSelect('u.deposito', 'd')
      .where('u.tenant_id = :tenantId', { tenantId })
      .andWhere('p.id = :presentacionId', { presentacionId })
      .andWhere('d.id = :depositoId', { depositoId })
      .andWhere('u.estado = :estado', { estado: 'DISPONIBLE' })
      .orderBy('l.fechaVencimiento', 'ASC', 'NULLS LAST')
      .addOrderBy('l.fechaProduccion', 'ASC')
      .addOrderBy('u.createdAt', 'ASC')

      .take(bultos)
      .getMany();

    if (unidades.length < bultos) {
      throw new BadRequestException(
        `Stock insuficiente de unidades envasadas (requerido ${bultos}, disponible ${unidades.length})`,
      );
    }

    return unidades;
  }

  private async validarLoteNoVencido(
    trx: any,
    tenantId: string,
    lote: LoteProductoFinal,
  ) {
    const loteRepo = trx.getRepository(LoteProductoFinal);

    if (lote.fechaVencimiento) {
      const hoy = new Date();
      const vencimiento = new Date(lote.fechaVencimiento);
      hoy.setHours(0, 0, 0, 0);
      vencimiento.setHours(0, 0, 0, 0);

      if (vencimiento < hoy) {
        // opcional: marcar vencido
        if (lote.estado !== LotePfEstado.VENCIDO) {
          lote.estado = LotePfEstado.VENCIDO;
          lote.motivoEstado = 'Vencido al entregar envasado';
          lote.fechaEstado = new Date();
          await loteRepo.save(lote);
        }
        throw new BadRequestException(
          `El lote ${lote.codigoLote} está vencido`,
        );
      }
    }
  }
}
