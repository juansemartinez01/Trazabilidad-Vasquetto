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
      const stockPresRepo = trx.getRepository(StockPresentacion);
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
        const lote = await loteRepo.findOne({
          where: { id: item.loteId, tenantId },
          relations: ['productoFinal', 'deposito'], // ✅ para validaciones y origen stock
        });
        if (!lote) throw new NotFoundException('Lote no encontrado');

        // 1) Validación vencimiento + estado LISTO (tu lógica OK)
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

        // 2) Depósito (depósito “operativo” de entrega)
        const deposito = await depRepo.findOne({
          where: { id: item.depositoId, tenantId },
        });
        if (!deposito) throw new NotFoundException('Depósito no encontrado');

        // 3) Presentación (opcional)
        let presentacion: PresentacionProductoFinal | null = null;

        if (item.presentacionId) {
          presentacion = await presRepo.findOne({
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

        // ============================
        // CAMINO A: ENTREGA A GRANEL (SIN PRESENTACIÓN)
        // ============================
        if (!presentacion) {
          if (item.cantidadKg == null) {
            throw new BadRequestException(
              'cantidadKg es requerida si no se envía presentacionId',
            );
          }

          const kgADescontar = Number(item.cantidadKg);
          if (kgADescontar <= 0) {
            throw new BadRequestException(
              'La cantidad a descontar debe ser > 0',
            );
          }

          if (Number(lote.cantidadActualKg) < kgADescontar) {
            throw new BadRequestException(
              `Stock insuficiente en lote ${lote.codigoLote} (disponible ${lote.cantidadActualKg}, requerido ${kgADescontar})`,
            );
          }

          // descontar del lote PF (granel)
          const loteActualizado = await this.stockService.consumirLotePF(
            tenantId,
            lote.id,
            kgADescontar,
            TipoMovimiento.ENTREGA,
            entrega.id,
          );

          const entregaItem = itemRepo.create({
            tenantId,
            entrega,
            lote,
            deposito,
            presentacion: null,
            cantidadKg: kgADescontar,
            cantidadBultos: Number(item.cantidadBultos ?? 0),
          });
          await itemRepo.save(entregaItem);

          if (Number(loteActualizado.cantidadActualKg) <= 0) {
            loteActualizado.estado = LotePfEstado.ENTREGADO;
            loteActualizado.motivoEstado = `Entregado (remito ${dto.numeroRemito})`;
            loteActualizado.fechaEstado = new Date();
            await loteRepo.save(loteActualizado);
          }

          continue;
        }

        // ============================
        // CAMINO B: ENTREGA POR PRESENTACIÓN
        // - NO descuenta del lote PF (porque ya se empacó)
        // - descuenta de stock_presentaciones
        // - si BULTO/UNIDAD: marca unidades envasadas como ENTREGADO
        // ============================

        if (presentacion.unidadVenta === UnidadVenta.KG) {
          // requiere cantidadKg
          if (item.cantidadKg == null) {
            throw new BadRequestException(
              `cantidadKg es requerida para la presentación ${presentacion.codigo} (unidad KG)`,
            );
          }

          const kg = Number(item.cantidadKg);
          if (kg <= 0)
            throw new BadRequestException(
              'La cantidad a entregar debe ser > 0',
            );

          // descontar de stock_presentaciones (KG)
          let stock = await stockPresRepo.findOne({
            where: {
              tenantId,
              presentacion: { id: presentacion.id } as any,
              deposito: { id: deposito.id } as any,
            },
          });

          if (!stock) {
            throw new BadRequestException(
              `No hay stock en presentación ${presentacion.codigo} en el depósito seleccionado`,
            );
          }

          const disponibleKg = dec(stock.stockKg);
          if (disponibleKg < kg) {
            throw new BadRequestException(
              `Stock insuficiente en presentación ${presentacion.codigo} (disponible ${disponibleKg}, requerido ${kg})`,
            );
          }

          stock.stockKg = disponibleKg - kg;
          await stockPresRepo.save(stock);

          // movimiento stock: entrega por presentación (kg)
          await movRepo.save(
            movRepo.create({
              tenantId,
              tipo: TipoMovimiento.ENTREGA,
              lotePF: lote, // trazabilidad hacia lote origen
              deposito,
              presentacion,
              cantidadKg: -kg,
              cantidadUnidades: null,
              referenciaId: entrega.id,
            }),
          );

          // crear item entrega
          const entregaItem = itemRepo.create({
            tenantId,
            entrega,
            lote,
            deposito,
            presentacion,
            cantidadKg: kg,
            cantidadBultos: 0,
          });
          await itemRepo.save(entregaItem);

          continue;
        }

        // BULTO / UNIDAD
        const bultos = Number(item.cantidadBultos ?? 0);
        if (!bultos || bultos <= 0) {
          throw new BadRequestException(
            `cantidadBultos es requerida para la presentación ${presentacion.codigo}`,
          );
        }

        const peso = Number(presentacion.pesoPorUnidadKg ?? 0);
        if (!peso || peso <= 0) {
          throw new BadRequestException(
            `La presentación ${presentacion.codigo} no tiene pesoPorUnidadKg configurado`,
          );
        }

        const kg = bultos * peso;
        if (kg <= 0) {
          throw new BadRequestException('La cantidad a entregar debe ser > 0');
        }

        // descontar de stock_presentaciones (UNIDADES)
        let stock = await stockPresRepo.findOne({
          where: {
            tenantId,
            presentacion: { id: presentacion.id } as any,
            deposito: { id: deposito.id } as any,
          },
        });

        if (!stock) {
          throw new BadRequestException(
            `No hay stock en presentación ${presentacion.codigo} en el depósito seleccionado`,
          );
        }

        const disponibleUnits = dec(stock.stockUnidades);
        if (disponibleUnits < bultos) {
          throw new BadRequestException(
            `Stock insuficiente en presentación ${presentacion.codigo} (disponible ${disponibleUnits}, requerido ${bultos})`,
          );
        }

        stock.stockUnidades = disponibleUnits - bultos;
        await stockPresRepo.save(stock);

        // marcar unidades envasadas como ENTREGADO (selecciona N disponibles)
        // Nota: esto asume que el stock por presentación refleja unidades envasadas disponibles.
        const unidades = await unidadRepo.find({
          where: {
            tenantId,
            deposito: { id: deposito.id } as any,
            presentacion: { id: presentacion.id } as any,
            loteOrigen: { id: lote.id } as any,
            estado: 'DISPONIBLE' as any,
          },
          take: bultos,
          order: { createdAt: 'ASC' as any },
        });

        if (unidades.length < bultos) {
          // si pasa, es inconsistencia entre stock_presentaciones y unidades_envasadas
          throw new BadRequestException(
            `Inconsistencia: hay stock ${disponibleUnits} pero unidades DISPONIBLES encontradas ${unidades.length} para ${presentacion.codigo} en lote ${lote.codigoLote}`,
          );
        }

        for (const u of unidades) {
          u.estado = 'ENTREGADO' as any;
        }
        await unidadRepo.save(unidades);

        // movimiento stock: entrega por presentación (unidades)
        await movRepo.save(
          movRepo.create({
            tenantId,
            tipo: TipoMovimiento.ENTREGA,
            lotePF: lote,
            deposito,
            presentacion,
            cantidadKg: -kg,
            cantidadUnidades: bultos,
            referenciaId: entrega.id,
          }),
        );

        // crear item entrega
        const entregaItem = itemRepo.create({
          tenantId,
          entrega,
          lote,
          deposito,
          presentacion,
          cantidadKg: kg, // normalizado
          cantidadBultos: bultos,
        });
        await itemRepo.save(entregaItem);
      }

      await this.auditoria.registrar(tenantId, usuarioId, 'ENTREGA_CREADA', {
        entregaId: entrega.id,
      });

      return this.obtener(tenantId, entrega.id);
    });
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
}
