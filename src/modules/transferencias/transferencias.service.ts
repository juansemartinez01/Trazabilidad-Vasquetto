import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import {
  Transferencia,
  TransferenciaEstado,
  TransferenciaTipo,
} from './entities/transferencia.entity';
import { TransferenciaItem } from './entities/transferencia-item.entity';
import { TransferenciaUnidad } from './entities/transferencia-unidad.entity';

import { Deposito } from '../deposito/entities/deposito.entity';
import { LoteMP } from '../lotes/entities/lote-mp.entity';
import {
  LotePfEstado,
  LoteProductoFinal,
} from '../lotes/entities/lote-producto-final.entity';
import {
  PresentacionProductoFinal,
  UnidadVenta,
} from '../producto-final/entities/presentacion-producto-final.entity';
import { PFUnidadEnvasada } from '../empaques/entities/pf-unidad-envasada.entity';
import { StockPresentacion } from '../empaques/entities/stock-presentacion.entity';

import { CreateTransferenciaDto } from './dto/create-transferencia.dto';

import {
  StockMovimiento,
  TipoMovimiento,
} from '../stock-movimiento/entities/stock-movimiento.entity';

function dec(n: any) {
  const v = Number(n);
  if (Number.isNaN(v)) return 0;
  return v;
}

@Injectable()
export class TransferenciasService {
  constructor(
    private ds: DataSource,

    @InjectRepository(Transferencia) private repo: Repository<Transferencia>,
    @InjectRepository(TransferenciaItem)
    private itemRepo: Repository<TransferenciaItem>,
    @InjectRepository(TransferenciaUnidad)
    private tuRepo: Repository<TransferenciaUnidad>,

    @InjectRepository(Deposito) private depRepo: Repository<Deposito>,
    @InjectRepository(LoteMP) private loteMpRepo: Repository<LoteMP>,
    @InjectRepository(LoteProductoFinal)
    private lotePfRepo: Repository<LoteProductoFinal>,
    @InjectRepository(PresentacionProductoFinal)
    private presRepo: Repository<PresentacionProductoFinal>,
    @InjectRepository(PFUnidadEnvasada)
    private unidadRepo: Repository<PFUnidadEnvasada>,
    @InjectRepository(StockPresentacion)
    private stockPresRepo: Repository<StockPresentacion>,

    @InjectRepository(StockMovimiento)
    private movRepo: Repository<StockMovimiento>,
  ) {}

  async crear(
    tenantId: string,
    usuarioId: string | null,
    dto: CreateTransferenciaDto,
  ) {
    if (dto.origenDepositoId === dto.destinoDepositoId) {
      throw new BadRequestException(
        'origenDepositoId y destinoDepositoId no pueden ser iguales',
      );
    }
    if (!dto.items?.length)
      throw new BadRequestException('La transferencia debe tener items');

    const origen = await this.depRepo.findOne({
      where: { id: dto.origenDepositoId, tenantId },
    });
    if (!origen) throw new NotFoundException('Depósito origen no encontrado');

    const destino = await this.depRepo.findOne({
      where: { id: dto.destinoDepositoId, tenantId },
    });
    if (!destino) throw new NotFoundException('Depósito destino no encontrado');

    const t = this.repo.create({
      tenantId,
      fecha: dto.fecha,
      origenDeposito: origen,
      destinoDeposito: destino,
      tipo: dto.tipo,
      estado: TransferenciaEstado.BORRADOR,
      observaciones: dto.observaciones ?? null,
      responsable: dto.responsableId
        ? ({ id: dto.responsableId } as any)
        : null,
      items: [],
      unidades: [],
    });

    const saved = await this.repo.save(t);

    for (const it of dto.items) {
      const item = this.itemRepo.create({
        tenantId,
        transferencia: saved,
        descripcion: it.descripcion ?? null,
        cantidadKg: it.cantidadKg ?? null,
        cantidadUnidades: it.cantidadUnidades ?? null,
        loteMp: it.loteMpId ? ({ id: it.loteMpId } as any) : null,
        lotePf: it.lotePfId ? ({ id: it.lotePfId } as any) : null,
        presentacion: it.presentacionId
          ? ({ id: it.presentacionId } as any)
          : null,
      });
      await this.itemRepo.save(item);
    }

    return this.obtener(tenantId, saved.id);
  }

  obtener(tenantId: string, id: string) {
    return this.repo.findOne({
      where: { tenantId, id },
      relations: ['items', 'unidades'],
    });
  }

  listar(tenantId: string) {
    return this.repo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' as any },
      relations: ['origenDeposito', 'destinoDeposito'],
    });
  }

  async confirmar(tenantId: string, usuarioId: string | null, id: string) {
    return this.ds.transaction(async (trx) => {
      const repo = trx.getRepository(Transferencia);
      const itemRepo = trx.getRepository(TransferenciaItem);
      const tuRepo = trx.getRepository(TransferenciaUnidad);

      const depRepo = trx.getRepository(Deposito);
      const loteMpRepo = trx.getRepository(LoteMP);
      const lotePfRepo = trx.getRepository(LoteProductoFinal);
      const presRepo = trx.getRepository(PresentacionProductoFinal);
      const unidadRepo = trx.getRepository(PFUnidadEnvasada);
      const stockPresRepo = trx.getRepository(StockPresentacion);
      const movRepo = trx.getRepository(StockMovimiento);

      const t = await repo.findOne({
        where: { tenantId, id },
        relations: [
          'origenDeposito',
          'destinoDeposito',
          'items',
          'items.loteMp',
          'items.lotePf',
          'items.presentacion',
        ],
      });
      if (!t) throw new NotFoundException('Transferencia no encontrada');
      if (t.estado !== TransferenciaEstado.BORRADOR) {
        throw new BadRequestException(
          'Solo se puede confirmar una transferencia en BORRADOR',
        );
      }

      const origen = await depRepo.findOne({
        where: { tenantId, id: t.origenDeposito.id },
      });
      const destino = await depRepo.findOne({
        where: { tenantId, id: t.destinoDeposito.id },
      });
      if (!origen || !destino)
        throw new NotFoundException('Depósitos inválidos');

      if (!t.items?.length)
        throw new BadRequestException('La transferencia no tiene items');

      // =====================
      // MP (split de lote)
      // =====================
      if (t.tipo === TransferenciaTipo.MP) {
        for (const it of t.items) {
          const kg = dec(it.cantidadKg);
          if (!it.loteMp?.id)
            throw new BadRequestException('MP requiere loteMpId');
          if (kg <= 0)
            throw new BadRequestException('cantidadKg requerida para MP');

          // ✅ LOCK SIN EAGER (evita LEFT JOIN + FOR UPDATE)
          const lote = await loteMpRepo.findOne({
            where: { tenantId, id: it.loteMp.id },
            lock: { mode: 'pessimistic_write' },
            loadEagerRelations: false,
          });

          if (!lote) throw new NotFoundException('Lote MP no encontrado');

          // ✅ validar depósito por FK (sin joins)
          const dep = await loteMpRepo
            .createQueryBuilder('l')
            .select('l.deposito_id', 'deposito_id')
            .where('l.tenant_id = :tenantId', { tenantId })
            .andWhere('l.id = :id', { id: it.loteMp.id })
            .getRawOne<{ deposito_id: string }>();

          if (!dep) {
            throw new NotFoundException('Lote MP no encontrado');
          }

          if (dep.deposito_id !== origen.id) {
            throw new BadRequestException(
              `El lote MP ${lote.codigoLote} no pertenece al depósito origen`,
            );
          }


          const disp = dec(lote.cantidadActualKg);
          if (disp < kg) {
            throw new BadRequestException(
              `Stock insuficiente en lote MP ${lote.codigoLote} (disp ${disp}, req ${kg})`,
            );
          }

          // 1) descontar origen
          lote.cantidadActualKg = disp - kg;
          await loteMpRepo.save(lote);

          // 2) crear lote destino (split)
          const codigoHijo = await this.generarCodigoSplitMP(
            trx,
            tenantId,
            lote.codigoLote,
          );

          const nuevo = loteMpRepo.create({
            tenantId,
            recepcion: (lote as any).recepcion, // NOT NULL
            materiaPrima: (lote as any).materiaPrima,
            deposito: destino,
            codigoLote: codigoHijo,
            fechaElaboracion: lote.fechaElaboracion,
            fechaAnalisis: lote.fechaAnalisis,
            fechaVencimiento: lote.fechaVencimiento,
            cantidadInicialKg: kg,
            cantidadActualKg: kg,
            analisis: lote.analisis ?? null,
            documentos: lote.documentos ?? null,
          });

          const loteDestino = await loteMpRepo.save(nuevo);

          // 3) movimientos (salida + entrada)
          await movRepo.save(
            movRepo.create({
              tenantId,
              tipo: TipoMovimiento.TRANSFERENCIA_MP as any,
              loteMP: { id: lote.id } as any,
              deposito: { id: origen.id } as any,
              cantidadKg: -kg,
              referenciaId: t.id,
              
            }),
          );

          await movRepo.save(
            movRepo.create({
              tenantId,
              tipo: TipoMovimiento.TRANSFERENCIA_MP as any,
              loteMP: { id: loteDestino.id } as any,
              deposito: { id: destino.id } as any,
              cantidadKg: +kg,
              referenciaId: t.id,
              
            }),
          );

          it.descripcion =
            it.descripcion ??
            `Split: ${lote.codigoLote} -> ${loteDestino.codigoLote}`;
          await itemRepo.save(it);
        }
      }

      // =====================
      // PF granel (split de lote)
      // =====================
      if (t.tipo === TransferenciaTipo.PF_GRANEL) {
        for (const it of t.items) {
          const kg = dec(it.cantidadKg);
          if (!it.lotePf?.id)
            throw new BadRequestException('PF_GRANEL requiere lotePfId');
          if (kg <= 0)
            throw new BadRequestException(
              'cantidadKg requerida para PF_GRANEL',
            );

          // ✅ LOCK SIN EAGER/RELATIONS
          const lote = await lotePfRepo.findOne({
            where: { tenantId, id: it.lotePf.id },
            lock: { mode: 'pessimistic_write' },
            loadEagerRelations: false,
          });
          if (!lote) throw new NotFoundException('Lote PF no encontrado');

          const depositoId =
            (lote as any).depositoId ?? (lote as any).deposito_id;
          if (depositoId && depositoId !== origen.id) {
            throw new BadRequestException(
              `El lote PF ${lote.codigoLote} no pertenece al depósito origen`,
            );
          }

          if (
            (lote as any).estado &&
            (lote as any).estado !== LotePfEstado.LISTO
          ) {
            throw new BadRequestException(
              `El lote ${lote.codigoLote} no está LISTO (estado: ${(lote as any).estado})`,
            );
          }

          const disp = dec(lote.cantidadActualKg);
          if (disp < kg)
            throw new BadRequestException(
              `Stock insuficiente en lote PF (disp ${disp}, req ${kg})`,
            );

          // descuenta origen
          lote.cantidadActualKg = disp - kg;
          await lotePfRepo.save(lote);

          // crea lote destino “hijo”
          const nuevo = lotePfRepo.create({
            tenantId,
            codigoLote: await this.generarCodigoSplit(
              trx,
              tenantId,
              lote.codigoLote,
              'PF',
            ),
            cantidadInicialKg: kg,
            cantidadActualKg: kg,
            deposito: destino,
            fechaProduccion: (lote as any).fechaProduccion,
            fechaVencimiento: (lote as any).fechaVencimiento,
            estado: LotePfEstado.LISTO,
            motivoEstado: `Split desde ${lote.codigoLote} por transferencia ${t.id}`,
            fechaEstado: new Date(),
            productoFinal: { id: (lote as any).productoFinalId } as any,
          });

          const loteDestino = await lotePfRepo.save(nuevo);

          await movRepo.save(
            movRepo.create({
              tenantId,
              tipo: TipoMovimiento.TRANSFERENCIA_PF as any,
              lotePF: { id: lote.id } as any,
              deposito: { id: origen.id } as any,
              cantidadKg: -kg,
              referenciaId: t.id,
              
            }),
          );
          await movRepo.save(
            movRepo.create({
              tenantId,
              tipo: TipoMovimiento.TRANSFERENCIA_PF as any,
              lotePF: { id: loteDestino.id } as any,
              deposito: { id: destino.id } as any,
              cantidadKg: +kg,
              referenciaId: t.id,
              
            }),
          );

          it.cantidadKg = kg;
          await itemRepo.save(it);
        }
      }

      // =====================
      // PF envasado (move unidades)
      // =====================
      if (t.tipo === TransferenciaTipo.PF_ENVASADO) {
        for (const it of t.items) {
          if (!it.presentacion?.id) {
            throw new BadRequestException(
              'PF_ENVASADO requiere presentacionId',
            );
          }

          const pres = await presRepo.findOne({
            where: { tenantId, id: it.presentacion.id },
            relations: ['productoFinal'],
          });
          if (!pres) throw new NotFoundException('Presentación no encontrada');
          if (pres.unidadVenta === UnidadVenta.KG) {
            throw new BadRequestException(
              'PF_ENVASADO es solo para presentaciones por UNIDAD/BULTO, no KG',
            );
          }

          const cant = Number(it.cantidadUnidades ?? 0);
          if (!Number.isFinite(cant) || cant <= 0) {
            throw new BadRequestException(
              'cantidadUnidades requerida para PF_ENVASADO',
            );
          }

          // FEFO: tomar unidades DISPONIBLE del depósito origen
          // OJO: acá el lock está OK porque usamos INNER JOIN (no outer join)
          const unidades = await unidadRepo
            .createQueryBuilder('u')
            .setLock('pessimistic_write')
            .innerJoinAndSelect('u.loteOrigen', 'l')
            .where('u.tenant_id = :tenantId', { tenantId })
            .andWhere('u.presentacion_id = :pid', { pid: pres.id })
            .andWhere('u.deposito_id = :did', { did: origen.id })
            .andWhere('u.estado = :estado', { estado: 'DISPONIBLE' })
            .orderBy('l.fecha_vencimiento', 'ASC', 'NULLS LAST')
            .addOrderBy('l.fecha_produccion', 'ASC')
            .addOrderBy('u.created_at', 'ASC')
            .take(cant)
            .getMany();

          if (unidades.length < cant) {
            throw new BadRequestException(
              `Stock insuficiente de unidades envasadas (req ${cant}, disp ${unidades.length})`,
            );
          }

          // mover unidades: cambia depósito
          for (const u of unidades) {
            (u as any).deposito = { id: destino.id } as any;
          }
          await unidadRepo.save(unidades);

          // guardar detalle en transferencia_unidades
          // ✅ usar referencia a transferencia por id (más estable dentro del trx)
          for (const u of unidades) {
            await tuRepo.save(
              tuRepo.create({
                tenantId,
                transferencia: { id: t.id } as any,
                unidad: { id: u.id } as any,
              }),
            );
          }

          // ajustar stock_presentaciones (origen -cant, destino +cant)
          const [stockO, stockD] = await Promise.all([
            stockPresRepo.findOne({
              where: {
                tenantId,
                presentacion: { id: pres.id } as any,
                deposito: { id: origen.id } as any,
              },
              lock: { mode: 'pessimistic_write' },
              loadEagerRelations: false,
            }),
            stockPresRepo.findOne({
              where: {
                tenantId,
                presentacion: { id: pres.id } as any,
                deposito: { id: destino.id } as any,
              },
              lock: { mode: 'pessimistic_write' },
              loadEagerRelations: false,
            }),
          ]);

          const so =
            stockO ??
            stockPresRepo.create({
              tenantId,
              presentacion: pres,
              deposito: origen,
              stockKg: 0,
              stockUnidades: 0,
            });

          const sd =
            stockD ??
            stockPresRepo.create({
              tenantId,
              presentacion: pres,
              deposito: destino,
              stockKg: 0,
              stockUnidades: 0,
            });

          so.stockUnidades = dec(so.stockUnidades) - cant;
          sd.stockUnidades = dec(sd.stockUnidades) + cant;

          if (dec(so.stockUnidades) < 0) {
            throw new BadRequestException(
              'StockPresentacion origen quedó negativo (desincronización)',
            );
          }

          await stockPresRepo.save([so, sd]);

          const peso = dec(
            (unidades[0] as any)?.pesoKg ?? pres.pesoPorUnidadKg,
          );
          const kgTotal = peso * cant;

          // agrupar por loteOrigen
          const map = new Map<string, number>();
          for (const u of unidades) {
            const lid = (u.loteOrigen as any)?.id;
            map.set(lid, (map.get(lid) ?? 0) + 1);
          }

          for (const [loteId, unidadesCant] of map.entries()) {
            const kg = unidadesCant * peso;

            await movRepo.save(
              movRepo.create({
                tenantId,
                tipo: TipoMovimiento.TRANSFERENCIA_ENVASADO as any,
                lotePF: { id: loteId } as any,
                deposito: { id: origen.id } as any,
                presentacion: { id: pres.id } as any,
                cantidadKg: -kg,
                cantidadUnidades: unidadesCant,
                referenciaId: t.id,
                
              }),
            );

            await movRepo.save(
              movRepo.create({
                tenantId,
                tipo: TipoMovimiento.TRANSFERENCIA_ENVASADO as any,
                lotePF: { id: loteId } as any,
                deposito: { id: destino.id } as any,
                presentacion: { id: pres.id } as any,
                cantidadKg: +kg,
                cantidadUnidades: unidadesCant,
                referenciaId: t.id,
                
              }),
            );
          }

          it.presentacion = pres;
          it.cantidadUnidades = cant;
          it.cantidadKg = kgTotal;
          await itemRepo.save(it);
        }
      }

      t.estado = TransferenciaEstado.CONFIRMADA;
      await repo.save(t);

      return repo.findOne({
        where: { tenantId, id: t.id },
        relations: ['items', 'unidades', 'origenDeposito', 'destinoDeposito'],
      });
    });
  }

  private async generarCodigoSplit(
    trx: any,
    tenantId: string,
    codigoBase: string,
    pref: 'PF' | 'MP',
  ) {
    const repo =
      pref === 'PF'
        ? trx.getRepository(LoteProductoFinal)
        : trx.getRepository(LoteMP);

    const base = `${codigoBase}-T`;
    const existing = (await repo
      .createQueryBuilder('l')
      .select('l.codigo_lote', 'codigo')
      .where('l.tenant_id = :tenantId', { tenantId })
      .andWhere('l.codigo_lote LIKE :p', { p: `${base}%` })
      .getRawMany()) as { codigo: string }[];

    let max = 0;
    for (const r of existing) {
      const c = r.codigo ?? '';
      const m = c.match(/-T(\d+)$/);
      if (m?.[1]) max = Math.max(max, Number(m[1]));
    }
    const next = String(max + 1).padStart(4, '0');
    return `${base}${next}`;
  }

  private async generarCodigoSplitMP(
    trx: any,
    tenantId: string,
    codigoBase: string,
  ) {
    const repo = trx.getRepository(LoteMP);
    const base = `${codigoBase}-T`;

    const rows = (await repo
      .createQueryBuilder('l')
      .select('l.codigo_lote', 'codigo')
      .where('l.tenant_id = :tenantId', { tenantId })
      .andWhere('l.codigo_lote LIKE :p', { p: `${base}%` })
      .getRawMany()) as { codigo: string }[];

    let max = 0;
    for (const r of rows) {
      const m = (r.codigo ?? '').match(/-T(\d+)$/);
      if (m?.[1]) max = Math.max(max, Number(m[1]));
    }
    return `${base}${String(max + 1).padStart(4, '0')}`;
  }
}
