// src/modules/trazabilidad/trazabilidad.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { LoteMP } from '../lotes/entities/lote-mp.entity';
import { LoteProductoFinal } from '../lotes/entities/lote-producto-final.entity';
import { OrdenConsumo } from '../orden-produccion/entities/orden-consumo.entity';
import { EntregaItem } from '../entregas/entities/entrega-item.entity';
import { Entrega } from '../entregas/entities/entrega.entity';

type Col = 'BACKWARD' | 'PROD' | 'FORWARD';
type Tipo = 'MP' | 'PF' | 'ENTREGA' | 'CLIENTE';

export interface TrazNodo {
  id: string; // id interno grafo (ej: "MP:uuid")
  tipo: Tipo;
  refId: string; // uuid real
  titulo: string;
  subtitulo?: string;
  badge?: string;
  meta?: Record<string, any>;
  col: Col;
}

export interface TrazLink {
  from: string;
  to: string;
  label?: string;
  meta?: Record<string, any>;
}

export interface TrazGrafoResponse {
  root: { tipo: Tipo; refId: string };
  nodos: TrazNodo[];
  links: TrazLink[];
  resumen?: Record<string, any>;
}

function nodeId(tipo: Tipo, refId: string) {
  return `${tipo}:${refId}`;
}

function fmtEntregaLabel(bultos?: number | null, kg?: number | null) {
  const parts: string[] = [];
  if (bultos && bultos > 0) parts.push(`${bultos} bultos`);
  if (kg && kg > 0) parts.push(`${kg.toFixed(2)} kg`);
  return parts.join(' · ') || undefined;
}

@Injectable()
export class TrazabilidadService {
  constructor(
    @InjectRepository(LoteMP) private readonly loteMPRepo: Repository<LoteMP>,
    @InjectRepository(LoteProductoFinal)
    private readonly lotePFRepo: Repository<LoteProductoFinal>,
    @InjectRepository(OrdenConsumo)
    private readonly consumoRepo: Repository<OrdenConsumo>,
    @InjectRepository(EntregaItem)
    private readonly entregaItemRepo: Repository<EntregaItem>,
    @InjectRepository(Entrega)
    private readonly entregaRepo: Repository<Entrega>,
  ) {}

  // =========================================================
  // GRAFO: MP -> PF -> CLIENTE (con meta de entrega/remito)
  // =========================================================
  async grafoDesdeMP(
    tenantId: string,
    loteMpId: string,
  ): Promise<TrazGrafoResponse> {
    const mp = await this.loteMPRepo.findOne({
      where: { id: loteMpId, tenantId },
      relations: [
        'materiaPrima',
        'deposito',
        'recepcion',
        'recepcion.proveedor',
      ],
    });
    if (!mp) throw new NotFoundException('Lote de MP no encontrado');

    // 1) Consumido en órdenes -> PF (vía joins)
    const consumos = await this.consumoRepo
      .createQueryBuilder('c')
      .innerJoin('c.ingrediente', 'ing')
      .innerJoin('ing.orden', 'op')
      .leftJoin('op.loteFinal', 'pf')
      .leftJoin('pf.productoFinal', 'pfProd')
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere('c.loteId = :loteMpId', { loteMpId })
      .select([
        'c.id as consumo_id',
        'c.cantidadKg as consumo_kg',
        'op.id as orden_id',
        'pf.id as pf_id',
        'pf.codigoLote as pf_codigo',
        'pf.estado as pf_estado',
        'pfProd.nombre as pf_nombre',
      ])
      .getRawMany<{
        consumo_id: string;
        consumo_kg: string;
        orden_id: string;
        pf_id: string | null;
        pf_codigo: string | null;
        pf_estado: string | null;
        pf_nombre: string | null;
      }>();

    const pfIds = Array.from(
      new Set(consumos.map((r) => r.pf_id).filter((x): x is string => !!x)),
    );

    // 2) Entregas/items SOLO para esos PF
    const entregas = pfIds.length
      ? await this.entregaItemRepo
          .createQueryBuilder('it')
          .innerJoin('it.entrega', 'e')
          .innerJoin('e.cliente', 'cli')
          .innerJoin('it.lote', 'pf')
          .leftJoin('it.presentacion', 'pres')
          .where('it.tenantId = :tenantId', { tenantId })
          .andWhere('pf.id IN (:...pfIds)', { pfIds })
          .select([
            'it.id as item_id',
            'pf.id as pf_id',
            'e.id as entrega_id',
            'e.numeroRemito as numero_remito',
            'e.fecha as entrega_fecha',
            'cli.id as cliente_id',
            'cli.nombre as cliente_nombre',
            'it.cantidadKg as cantidad_kg',
            'it.cantidadBultos as cantidad_bultos',
            'pres.id as pres_id',
            'pres.codigo as pres_codigo',
            'pres.nombre as pres_nombre',
          ])
          .getRawMany<{
            item_id: string;
            pf_id: string;
            entrega_id: string;
            numero_remito: string;
            entrega_fecha: string;
            cliente_id: string;
            cliente_nombre: string;
            cantidad_kg: string | null;
            cantidad_bultos: string | null;
            pres_id: string | null;
            pres_codigo: string | null;
            pres_nombre: string | null;
          }>()
      : [];

    // 3) Armar grafo
    const nodosMap = new Map<string, TrazNodo>();
    const links: TrazLink[] = [];

    const upsertNodo = (n: TrazNodo) => {
      if (!nodosMap.has(n.id)) nodosMap.set(n.id, n);
    };

    const mpNode: TrazNodo = {
      id: nodeId('MP', mp.id),
      tipo: 'MP',
      refId: mp.id,
      titulo: mp.materiaPrima?.nombre ?? 'Materia prima',
      subtitulo: `LOT: ${mp.codigoLote}`,
      badge: mp.deposito?.nombre,
      meta: {
        fechaElaboracion: mp.fechaElaboracion,
        fechaVencimiento: mp.fechaVencimiento,
        kgActual: Number(mp.cantidadActualKg),
        recepcionId: mp.recepcion?.id,
        proveedor: mp.recepcion?.proveedor
          ? {
              id: mp.recepcion.proveedor.id,
              nombre: mp.recepcion.proveedor.razonSocial,
            }
          : null,
      },
      col: 'BACKWARD',
    };
    upsertNodo(mpNode);

    // MP -> PF (sumar kg consumidos por PF)
    const consumoKgPorPf = new Map<string, number>();
    const ordenPorPf = new Map<string, string>();

    for (const r of consumos) {
      if (!r.pf_id) continue;
      const kg = Number(r.consumo_kg ?? 0);
      consumoKgPorPf.set(r.pf_id, (consumoKgPorPf.get(r.pf_id) ?? 0) + kg);
      ordenPorPf.set(r.pf_id, r.orden_id);

      upsertNodo({
        id: nodeId('PF', r.pf_id),
        tipo: 'PF',
        refId: r.pf_id,
        titulo: r.pf_nombre ?? 'Producto final',
        subtitulo: r.pf_codigo ? `LOT: ${r.pf_codigo}` : undefined,
        badge: r.pf_estado ?? undefined,
        meta: { ordenId: r.orden_id },
        col: 'PROD',
      });
    }

    for (const [pfId, kg] of consumoKgPorPf.entries()) {
      links.push({
        from: mpNode.id,
        to: nodeId('PF', pfId),
        label: `${kg.toFixed(2)} kg`,
        meta: { kg, ordenId: ordenPorPf.get(pfId) },
      });
    }

    // PF -> Cliente (con meta de entrega)
    for (const e of entregas) {
      const clienteNodeId = nodeId('CLIENTE', e.cliente_id);

      upsertNodo({
        id: clienteNodeId,
        tipo: 'CLIENTE',
        refId: e.cliente_id,
        titulo: e.cliente_nombre,
        col: 'FORWARD',
      });

      const bultos = e.cantidad_bultos ? Number(e.cantidad_bultos) : 0;
      const kg = e.cantidad_kg ? Number(e.cantidad_kg) : 0;

      links.push({
        from: nodeId('PF', e.pf_id),
        to: clienteNodeId,
        label: fmtEntregaLabel(bultos, kg),
        meta: {
          entregaId: e.entrega_id,
          numeroRemito: e.numero_remito,
          fecha: e.entrega_fecha,
          itemId: e.item_id,
          cantidadBultos: bultos,
          cantidadKg: kg,
          presentacion: e.pres_id
            ? { id: e.pres_id, codigo: e.pres_codigo, nombre: e.pres_nombre }
            : null,
        },
      });
    }

    return {
      root: { tipo: 'MP', refId: mp.id },
      nodos: Array.from(nodosMap.values()),
      links,
      resumen: {
        pfCount: pfIds.length,
        clientesCount: new Set(entregas.map((x) => x.cliente_id)).size,
        entregasCount: new Set(entregas.map((x) => x.entrega_id)).size,
      },
    };
  }

  // =========================================================
  // GRAFO: ENTREGA -> PF -> MP
  // =========================================================
  async grafoDesdeEntrega(
    tenantId: string,
    entregaId: string,
  ): Promise<TrazGrafoResponse> {
    // Traemos entrega para nodo root bien descriptivo
    const entrega = await this.entregaRepo.findOne({
      where: { id: entregaId, tenantId },
      relations: ['cliente'],
    });
    if (!entrega) throw new NotFoundException('Entrega no encontrada');

    // 1) Items de entrega + PF + presentación
    const items = await this.entregaItemRepo
      .createQueryBuilder('it')
      .innerJoin('it.entrega', 'e')
      .innerJoin('e.cliente', 'cli')
      .innerJoin('it.lote', 'pf')
      .leftJoin('pf.productoFinal', 'pfProd')
      .leftJoin('it.presentacion', 'pres')
      .where('it.tenantId = :tenantId', { tenantId })
      .andWhere('e.id = :entregaId', { entregaId })
      .select([
        'it.id as item_id',
        'pf.id as pf_id',
        'pf.codigoLote as pf_codigo',
        'pf.estado as pf_estado',
        'pfProd.nombre as pf_nombre',
        'it.cantidadKg as cantidad_kg',
        'it.cantidadBultos as cantidad_bultos',
        'pres.id as pres_id',
        'pres.codigo as pres_codigo',
        'pres.nombre as pres_nombre',
        'cli.id as cliente_id',
        'cli.nombre as cliente_nombre',
        'e.numeroRemito as numero_remito',
        'e.fecha as entrega_fecha',
      ])
      .getRawMany<{
        item_id: string;
        pf_id: string;
        pf_codigo: string;
        pf_estado: string;
        pf_nombre: string | null;
        cantidad_kg: string | null;
        cantidad_bultos: string | null;
        pres_id: string | null;
        pres_codigo: string | null;
        pres_nombre: string | null;
        cliente_id: string;
        cliente_nombre: string;
        numero_remito: string;
        entrega_fecha: string;
      }>();

    if (!items.length) throw new NotFoundException('Entrega sin items');

    const pfIds = Array.from(new Set(items.map((i) => i.pf_id)));

    // 2) Para esos PF, buscamos MP consumidas (PF -> Orden -> Consumos -> MP)
    const consumos = await this.consumoRepo
      .createQueryBuilder('c')
      .innerJoin('c.ingrediente', 'ing')
      .innerJoin('ing.orden', 'op')
      .innerJoin('op.loteFinal', 'pf')
      .innerJoin('c.lote', 'mp')
      .leftJoin('mp.materiaPrima', 'mpMat')
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere('pf.id IN (:...pfIds)', { pfIds })
      .select([
        'pf.id as pf_id',
        'op.id as orden_id',
        'mp.id as mp_id',
        'mp.codigoLote as mp_codigo',
        'mpMat.nombre as mp_nombre',
        'c.cantidadKg as consumo_kg',
      ])
      .getRawMany<{
        pf_id: string;
        orden_id: string;
        mp_id: string;
        mp_codigo: string;
        mp_nombre: string | null;
        consumo_kg: string;
      }>();

    // 3) Armar grafo
    const nodosMap = new Map<string, TrazNodo>();
    const links: TrazLink[] = [];
    const upsertNodo = (n: TrazNodo) => {
      if (!nodosMap.has(n.id)) nodosMap.set(n.id, n);
    };

    const entregaNode: TrazNodo = {
      id: nodeId('ENTREGA', entrega.id),
      tipo: 'ENTREGA',
      refId: entrega.id,
      titulo: `Entrega ${entrega.numeroRemito}`,
      subtitulo: entrega.fecha ? `Fecha: ${String(entrega.fecha)}` : undefined,
      badge: entrega.cliente?.razonSocial,
      meta: {
        numeroRemito: entrega.numeroRemito,
        fecha: entrega.fecha,
        cliente: entrega.cliente
          ? { id: entrega.cliente.id, nombre: entrega.cliente.razonSocial }
          : null,
      },
      col: 'FORWARD',
    };
    upsertNodo(entregaNode);

    const clienteNode: TrazNodo = {
      id: nodeId('CLIENTE', entrega.cliente.id),
      tipo: 'CLIENTE',
      refId: entrega.cliente.id,
      titulo: entrega.cliente.razonSocial,
      col: 'FORWARD',
    };
    upsertNodo(clienteNode);

    // Entrega -> Cliente (útil si tu UI lo quiere explícito)
    links.push({ from: entregaNode.id, to: clienteNode.id });

    // Entrega -> PF (por item)
    for (const it of items) {
      upsertNodo({
        id: nodeId('PF', it.pf_id),
        tipo: 'PF',
        refId: it.pf_id,
        titulo: it.pf_nombre ?? 'Producto final',
        subtitulo: `LOT: ${it.pf_codigo}`,
        badge: it.pf_estado,
        meta: {
          presentacion: it.pres_id
            ? { id: it.pres_id, codigo: it.pres_codigo, nombre: it.pres_nombre }
            : null,
        },
        col: 'PROD',
      });

      const bultos = it.cantidad_bultos ? Number(it.cantidad_bultos) : 0;
      const kg = it.cantidad_kg ? Number(it.cantidad_kg) : 0;

      links.push({
        from: entregaNode.id,
        to: nodeId('PF', it.pf_id),
        label: fmtEntregaLabel(bultos, kg),
        meta: {
          itemId: it.item_id,
          cantidadBultos: bultos,
          cantidadKg: kg,
          presentacion: it.pres_id
            ? { id: it.pres_id, codigo: it.pres_codigo, nombre: it.pres_nombre }
            : null,
        },
      });
    }

    // MP -> PF (consumos, agregados por par PF-MP)
    const consumoKgPorPfMp = new Map<string, number>(); // key pf|mp
    const ordenPorPfMp = new Map<string, string>(); // key pf|mp -> ordenId

    for (const c of consumos) {
      const mpNode: TrazNodo = {
        id: nodeId('MP', c.mp_id),
        tipo: 'MP',
        refId: c.mp_id,
        titulo: c.mp_nombre ?? 'Materia prima',
        subtitulo: `LOT: ${c.mp_codigo}`,
        col: 'BACKWARD',
      };
      upsertNodo(mpNode);

      const kg = Number(c.consumo_kg ?? 0);
      const key = `${c.pf_id}|${c.mp_id}`;
      consumoKgPorPfMp.set(key, (consumoKgPorPfMp.get(key) ?? 0) + kg);
      ordenPorPfMp.set(key, c.orden_id);
    }

    for (const [key, kg] of consumoKgPorPfMp.entries()) {
      const [pfId, mpId] = key.split('|');
      links.push({
        from: nodeId('MP', mpId),
        to: nodeId('PF', pfId),
        label: `${kg.toFixed(2)} kg`,
        meta: { kg, ordenId: ordenPorPfMp.get(key) },
      });
    }

    return {
      root: { tipo: 'ENTREGA', refId: entrega.id },
      nodos: Array.from(nodosMap.values()),
      links,
      resumen: {
        pfCount: pfIds.length,
        mpCount: new Set(consumos.map((x) => x.mp_id)).size,
      },
    };
  }

  // =========================================================
  // GRAFO: PF completo (backward MP + forward clientes/entregas)
  // =========================================================
  async grafoDesdePF(
    tenantId: string,
    lotePfId: string,
  ): Promise<TrazGrafoResponse> {
    const pf = await this.lotePFRepo.findOne({
      where: { id: lotePfId, tenantId },
      relations: ['deposito', 'productoFinal'],
    });
    if (!pf) throw new NotFoundException('Lote PF no encontrado');

    // 1) Backward: MP consumidas para producir este PF
    const consumos = await this.consumoRepo
      .createQueryBuilder('c')
      .innerJoin('c.ingrediente', 'ing')
      .innerJoin('ing.orden', 'op')
      .innerJoin('op.loteFinal', 'pf')
      .innerJoin('c.lote', 'mp')
      .leftJoin('mp.materiaPrima', 'mpMat')
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere('pf.id = :lotePfId', { lotePfId })
      .select([
        'op.id as orden_id',
        'mp.id as mp_id',
        'mp.codigoLote as mp_codigo',
        'mpMat.nombre as mp_nombre',
        'c.cantidadKg as consumo_kg',
      ])
      .getRawMany<{
        orden_id: string;
        mp_id: string;
        mp_codigo: string;
        mp_nombre: string | null;
        consumo_kg: string;
      }>();

    // 2) Forward: entregas/items donde se entregó este PF
    const entregas = await this.entregaItemRepo
      .createQueryBuilder('it')
      .innerJoin('it.entrega', 'e')
      .innerJoin('e.cliente', 'cli')
      .innerJoin('it.lote', 'pf')
      .leftJoin('it.presentacion', 'pres')
      .where('it.tenantId = :tenantId', { tenantId })
      .andWhere('pf.id = :lotePfId', { lotePfId })
      .select([
        'it.id as item_id',
        'e.id as entrega_id',
        'e.numeroRemito as numero_remito',
        'e.fecha as entrega_fecha',
        'cli.id as cliente_id',
        'cli.nombre as cliente_nombre',
        'it.cantidadKg as cantidad_kg',
        'it.cantidadBultos as cantidad_bultos',
        'pres.id as pres_id',
        'pres.codigo as pres_codigo',
        'pres.nombre as pres_nombre',
      ])
      .getRawMany<{
        item_id: string;
        entrega_id: string;
        numero_remito: string;
        entrega_fecha: string;
        cliente_id: string;
        cliente_nombre: string;
        cantidad_kg: string | null;
        cantidad_bultos: string | null;
        pres_id: string | null;
        pres_codigo: string | null;
        pres_nombre: string | null;
      }>();

    // 3) Armar grafo
    const nodosMap = new Map<string, TrazNodo>();
    const links: TrazLink[] = [];
    const upsertNodo = (n: TrazNodo) => {
      if (!nodosMap.has(n.id)) nodosMap.set(n.id, n);
    };

    const pfNode: TrazNodo = {
      id: nodeId('PF', pf.id),
      tipo: 'PF',
      refId: pf.id,
      titulo: pf.productoFinal?.nombre ?? 'Producto final',
      subtitulo: `LOT: ${pf.codigoLote}`,
      badge: pf.estado,
      meta: {
        deposito: pf.deposito?.nombre,
        fechaProduccion: pf.fechaProduccion,
        fechaVencimiento: pf.fechaVencimiento,
        kgActual: Number(pf.cantidadActualKg),
      },
      col: 'PROD',
    };
    upsertNodo(pfNode);

    // Backward MP -> PF (agregado por MP)
    const kgPorMp = new Map<string, number>();
    const ordenPorMp = new Map<string, string>();

    for (const c of consumos) {
      upsertNodo({
        id: nodeId('MP', c.mp_id),
        tipo: 'MP',
        refId: c.mp_id,
        titulo: c.mp_nombre ?? 'Materia prima',
        subtitulo: `LOT: ${c.mp_codigo}`,
        col: 'BACKWARD',
      });

      const kg = Number(c.consumo_kg ?? 0);
      kgPorMp.set(c.mp_id, (kgPorMp.get(c.mp_id) ?? 0) + kg);
      ordenPorMp.set(c.mp_id, c.orden_id);
    }

    for (const [mpId, kg] of kgPorMp.entries()) {
      links.push({
        from: nodeId('MP', mpId),
        to: pfNode.id,
        label: `${kg.toFixed(2)} kg`,
        meta: { kg, ordenId: ordenPorMp.get(mpId) },
      });
    }

    // Forward PF -> Cliente (con meta entrega)
    for (const e of entregas) {
      const clienteNodeId = nodeId('CLIENTE', e.cliente_id);

      upsertNodo({
        id: clienteNodeId,
        tipo: 'CLIENTE',
        refId: e.cliente_id,
        titulo: e.cliente_nombre,
        col: 'FORWARD',
      });

      const bultos = e.cantidad_bultos ? Number(e.cantidad_bultos) : 0;
      const kg = e.cantidad_kg ? Number(e.cantidad_kg) : 0;

      links.push({
        from: pfNode.id,
        to: clienteNodeId,
        label: fmtEntregaLabel(bultos, kg),
        meta: {
          entregaId: e.entrega_id,
          numeroRemito: e.numero_remito,
          fecha: e.entrega_fecha,
          itemId: e.item_id,
          cantidadBultos: bultos,
          cantidadKg: kg,
          presentacion: e.pres_id
            ? { id: e.pres_id, codigo: e.pres_codigo, nombre: e.pres_nombre }
            : null,
        },
      });
    }

    return {
      root: { tipo: 'PF', refId: pf.id },
      nodos: Array.from(nodosMap.values()),
      links,
      resumen: {
        mpCount: kgPorMp.size,
        clientesCount: new Set(entregas.map((x) => x.cliente_id)).size,
        entregasCount: new Set(entregas.map((x) => x.entrega_id)).size,
      },
    };
  }

  // =========================================================
  // BUSCADOR UNIFICADO (id puede ser MP, PF o Entrega)
  // =========================================================
  async buscar(tenantId: string, id: string) {
    // PF
    const pf = await this.lotePFRepo.findOne({ where: { id, tenantId } });
    if (pf) return { tipo: 'PF', ...(await this.grafoDesdePF(tenantId, id)) };

    // MP
    const mp = await this.loteMPRepo.findOne({ where: { id, tenantId } });
    if (mp) return { tipo: 'MP', ...(await this.grafoDesdeMP(tenantId, id)) };

    // Entrega
    const ent = await this.entregaRepo.findOne({ where: { id, tenantId } });
    if (ent)
      return {
        tipo: 'ENTREGA',
        ...(await this.grafoDesdeEntrega(tenantId, id)),
      };

    throw new NotFoundException('No se encontró trazabilidad para este ID');
  }
}
