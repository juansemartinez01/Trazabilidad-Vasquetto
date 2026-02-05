import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoteProductoFinal } from '../lotes/entities/lote-producto-final.entity';
import { QueryEstadisticasProduccionDto } from './dto/query-estadisticas-produccion.dto';
import { QueryTortaProduccionDto } from './dto/query-torta-produccion.dto';
import { Entrega } from '../entregas/entities/entrega.entity';
import { QueryEstadisticasClientesDto } from './dto/query-estadisticas-clientes.dto';
import { Recepcion } from '../recepciones/entities/recepcion.entity';
import { QueryEstadisticasProveedoresDto } from './dto/query-estadisticas-proveedores.dto';


type TortaProduccionItem = {
  productoFinalId: string | null;
  productoFinalNombre: string;
  cantidadKg: number;
  porcentaje: number;
};

type SerieClienteRow = {
  periodo: string; // siempre ISO string
  clienteId: string | null;
  clienteNombre: string;
  cantidadKg: number;
};

type SerieProveedorRow = {
  periodo: string; // ISO
  proveedorId: string | null;
  proveedorNombre: string;
  cantidadKg: number; // kg ingresados
  recepciones: number; // cantidad de recepciones
};


@Injectable()
export class EstadisticasService {
  constructor(
    @InjectRepository(LoteProductoFinal)
    private readonly lotePfRepo: Repository<LoteProductoFinal>,
    @InjectRepository(Entrega)
    private readonly entregaRepo: Repository<Entrega>,
    @InjectRepository(Recepcion)
    private readonly recepcionRepo: Repository<Recepcion>,
  ) {}

  async produccion(tenantId: string, q: QueryEstadisticasProduccionDto) {
    const periodo = q.periodo ?? 'month';
    const agruparPor = q.agruparPor ?? 'total';

    // seguridad: date_trunc acepta 'month'|'year', no interpolar cualquier cosa
    if (periodo !== 'month' && periodo !== 'year') {
      throw new BadRequestException('periodo inválido');
    }

    const trunc = periodo; // 'month' | 'year'

    // Base query
    const qb = this.lotePfRepo
      .createQueryBuilder('l')
      .leftJoin('l.productoFinal', 'pf')
      .where('l.tenantId = :tenantId', { tenantId });

    // filtros de fechas (usamos fechaProduccion)
    if (q.desde) qb.andWhere('l.fechaProduccion >= :desde', { desde: q.desde });
    if (q.hasta) qb.andWhere('l.fechaProduccion <= :hasta', { hasta: q.hasta });

    // filtro por producto
    if (q.productoFinalId) {
      qb.andWhere('pf.id = :pfId', { pfId: q.productoFinalId });
    }

    // ---------- SELECT + GROUP BY ----------
    // Armamos bucket por periodo con DATE_TRUNC
    // Importante: usamos getRawMany para devolver números limpios.
    const bucketExpr = `DATE_TRUNC('${trunc}', l.fechaProduccion)`;

    if (agruparPor === 'total') {
      qb.select([
        `${bucketExpr} AS "periodo"`,
        `SUM(l.cantidadInicialKg) AS "cantidadKg"`,
      ])
        .groupBy(`"periodo"`)
        .orderBy(`"periodo"`, 'ASC');

      const rows = await qb.getRawMany<{
        periodo: string;
        cantidadKg: string;
      }>();

      return rows.map((r) => ({
        periodo: r.periodo, // ISO timestamptz string (Postgres)
        cantidadKg: Number(r.cantidadKg ?? 0),
      }));
    }

    // agruparPor === 'producto'
    qb.select([
      `${bucketExpr} AS "periodo"`,
      `pf.id AS "productoFinalId"`,
      `pf.nombre AS "productoFinalNombre"`,
      `SUM(l.cantidadInicialKg) AS "cantidadKg"`,
    ])
      .groupBy(`"periodo"`)
      .addGroupBy(`pf.id`)
      .addGroupBy(`pf.nombre`)
      .orderBy(`"periodo"`, 'ASC')
      .addOrderBy(`pf.nombre`, 'ASC');

    const rows = await qb.getRawMany<{
      periodo: string;
      productoFinalId: string;
      productoFinalNombre: string;
      cantidadKg: string;
    }>();

    return rows.map((r) => ({
      periodo: r.periodo,
      productoFinalId: r.productoFinalId,
      productoFinalNombre: r.productoFinalNombre,
      cantidadKg: Number(r.cantidadKg ?? 0),
    }));
  }

  async tortaProduccion(tenantId: string, q: QueryTortaProduccionDto) {
    const incluirOtros = (q.incluirOtros ?? 'true') === 'true';
    const top = q.top ?? 20;

    // 1) Totales por producto (ordenado desc)
    const qb = this.lotePfRepo
      .createQueryBuilder('l')
      .leftJoin('l.productoFinal', 'pf')
      .where('l.tenantId = :tenantId', { tenantId });

    if (q.desde) qb.andWhere('l.fechaProduccion >= :desde', { desde: q.desde });
    if (q.hasta) qb.andWhere('l.fechaProduccion <= :hasta', { hasta: q.hasta });

    qb.select([
      'pf.id AS "productoFinalId"',
      'pf.nombre AS "productoFinalNombre"',
      'SUM(l.cantidadInicialKg) AS "cantidadKg"',
    ])
      .groupBy('pf.id')
      .addGroupBy('pf.nombre')
      .orderBy('"cantidadKg"', 'DESC');

    const rowsAll = await qb.getRawMany<{
      productoFinalId: string;
      productoFinalNombre: string;
      cantidadKg: string;
    }>();

    // 2) Total general
    const totalGeneral = rowsAll.reduce(
      (acc, r) => acc + Number(r.cantidadKg ?? 0),
      0,
    );

    if (totalGeneral <= 0) {
      return {
        totalKg: 0,
        items: [],
      };
    }

    // 3) Top N + (opcional) OTROS
    const topRows = rowsAll.slice(0, top);
    const restRows = rowsAll.slice(top);

    const itemsTop: TortaProduccionItem[] = topRows.map((r) => {
      const kg = Number(r.cantidadKg ?? 0);
      return {
        productoFinalId: r.productoFinalId,
        productoFinalNombre: r.productoFinalNombre,
        cantidadKg: kg,
        porcentaje: Number(((kg * 100) / totalGeneral).toFixed(2)),
      };
    });

    if (incluirOtros && restRows.length > 0) {
      const kgOtros = restRows.reduce(
        (acc, r) => acc + Number(r.cantidadKg ?? 0),
        0,
      );

      if (kgOtros > 0) {
        itemsTop.push({
          productoFinalId: null,
          productoFinalNombre: 'OTROS',
          cantidadKg: kgOtros,
          porcentaje: Number(((kgOtros * 100) / totalGeneral).toFixed(2)),
        });
      }
    }

    // 4) (opcional) ajuste de redondeo para que sume 100.00
    // si querés exactitud, lo podemos hacer, pero normalmente no hace falta.

    return {
      totalKg: Number(totalGeneral.toFixed(6)),
      items: itemsTop,
    };
  }

  async clientes(tenantId: string, q: QueryEstadisticasClientesDto) {
    const periodo = q.periodo ?? 'month';
    const trunc = periodo; // 'month'|'year'

    if (trunc !== 'month' && trunc !== 'year') {
      throw new BadRequestException('periodo inválido');
    }

    const incluirOtros = (q.incluirOtros ?? 'true') === 'true';
    const top = q.top ?? 10;

    // ----------------------------
    // 1) Determinar "top clientes" (si NO viene clienteId)
    // ----------------------------
    let topIds: string[] | null = null;

    if (!q.clienteId) {
      const topQb = this.entregaRepo
        .createQueryBuilder('e')
        .leftJoin('e.cliente', 'c')
        .leftJoin('e.items', 'it') // <- asumo relación Entrega.items -> EntregaItem
        .where('e.tenantId = :tenantId', { tenantId });

      if (q.desde) topQb.andWhere('e.fecha >= :desde', { desde: q.desde });
      if (q.hasta) topQb.andWhere('e.fecha <= :hasta', { hasta: q.hasta });

      topQb
        .select(['c.id AS "clienteId"', 'SUM(it.cantidadKg) AS "cantidadKg"'])
        .groupBy('c.id')
        .orderBy('"cantidadKg"', 'DESC')
        .limit(top);

      const topRows = await topQb.getRawMany<{
        clienteId: string;
        cantidadKg: string;
      }>();
      topIds = topRows.map((r) => r.clienteId).filter(Boolean);
    }

    // ----------------------------
    // 2) Query principal por periodo + cliente
    // ----------------------------
    const bucketExpr = `DATE_TRUNC('${trunc}', e.fecha)`;

    const qb = this.entregaRepo
      .createQueryBuilder('e')
      .leftJoin('e.cliente', 'c')
      .leftJoin('e.items', 'it')
      .where('e.tenantId = :tenantId', { tenantId });

    if (q.desde) qb.andWhere('e.fecha >= :desde', { desde: q.desde });
    if (q.hasta) qb.andWhere('e.fecha <= :hasta', { hasta: q.hasta });

    // Si viene clienteId, filtramos directo
    if (q.clienteId) {
      qb.andWhere('c.id = :cid', { cid: q.clienteId });
    } else if (topIds && topIds.length > 0 && incluirOtros) {
      // Traemos top + no-top para poder calcular OTROS
      // (no filtramos acá, filtramos luego en JS separando)
    } else if (topIds && topIds.length > 0 && !incluirOtros) {
      // Solo top
      qb.andWhere('c.id IN (:...topIds)', { topIds });
    }

    qb.select([
      `${bucketExpr} AS "periodo"`,
      `c.id AS "clienteId"`,
      `c.razonSocial AS "clienteNombre"`, // ajustá si tu cliente tiene otro campo
      `SUM(it.cantidadKg) AS "cantidadKg"`,
    ])
      .groupBy('"periodo"')
      .addGroupBy('c.id')
      .addGroupBy('c.razonSocial')
      .orderBy('"periodo"', 'ASC')
      .addOrderBy('c.razonSocial', 'ASC');

    const rows = await qb.getRawMany<{
      periodo: string;
      clienteId: string;
      clienteNombre: string;
      cantidadKg: string;
    }>();

    const normalized: SerieClienteRow[] = rows.map((r) => ({
      periodo: new Date(r.periodo as any).toISOString(),
      clienteId: r.clienteId,
      clienteNombre: r.clienteNombre,
      cantidadKg: Number(r.cantidadKg ?? 0),
    }));

    // ----------------------------
    // 3) Si no hay topIds (porque vino clienteId), devolvemos directo
    // ----------------------------
    if (q.clienteId) {
      return {
        periodo: trunc,
        desde: q.desde ?? null,
        hasta: q.hasta ?? null,
        top: null,
        incluirOtros: false,
        items: normalized,
      };
    }

    // ----------------------------
    // 4) Top + OTROS (si corresponde)
    // ----------------------------
    if (!topIds || topIds.length === 0) {
      return {
        periodo: trunc,
        desde: q.desde ?? null,
        hasta: q.hasta ?? null,
        top,
        incluirOtros,
        items: [],
      };
    }

    if (!incluirOtros) {
      // ya filtramos en SQL, devolvemos tal cual
      return {
        periodo: trunc,
        desde: q.desde ?? null,
        hasta: q.hasta ?? null,
        top,
        incluirOtros: false,
        items: normalized,
      };
    }

    // incluirOtros=true:
    // separo top vs resto y genero fila "OTROS" por periodo
    const topSet = new Set(topIds);

    const topRows = normalized.filter((r) => topSet.has(r.clienteId ?? ''));
    const restRows = normalized.filter((r) => !topSet.has(r.clienteId ?? ''));

    // Agrupar "resto" por periodo
    const otrosByPeriodo = new Map<string, number>();
    for (const r of restRows) {
      otrosByPeriodo.set(
        r.periodo,
        (otrosByPeriodo.get(r.periodo) ?? 0) + r.cantidadKg,
      );
    }

    const otrosRows: SerieClienteRow[] = Array.from(otrosByPeriodo.entries())
      .filter(([, kg]) => kg > 0)
      .map(([periodoStr, kg]) => ({
        periodo: periodoStr,
        clienteId: null,
        clienteNombre: 'OTROS',
        cantidadKg: Number(kg.toFixed(6)),
      }));

    return {
      periodo: trunc,
      desde: q.desde ?? null,
      hasta: q.hasta ?? null,
      top,
      incluirOtros: true,
      items: [...topRows, ...otrosRows].sort((a, b) =>
        a.periodo === b.periodo
          ? a.clienteNombre.localeCompare(b.clienteNombre)
          : a.periodo.localeCompare(b.periodo),
      ),
    };
  }

  async proveedores(tenantId: string, q: QueryEstadisticasProveedoresDto) {
    const periodo = q.periodo ?? 'month';
    if (periodo !== 'month' && periodo !== 'year') {
      throw new BadRequestException('periodo inválido');
    }

    const incluirOtros = (q.incluirOtros ?? 'true') === 'true';
    const top = q.top ?? 10;

    // ----------------------------
    // 1) Top proveedores por KG (si no viene proveedorId)
    // ----------------------------
    let topIds: string[] | null = null;

    if (!q.proveedorId) {
      const topQb = this.recepcionRepo
        .createQueryBuilder('r')
        .leftJoin('r.proveedor', 'p')
        .leftJoin('r.lotes', 'l') // LoteMP
        .where('r.tenantId = :tenantId', { tenantId });

      if (q.desde)
        topQb.andWhere('r.fechaRemito >= :desde', { desde: q.desde });
      if (q.hasta)
        topQb.andWhere('r.fechaRemito <= :hasta', { hasta: q.hasta });

      topQb
        .select([
          'p.id AS "proveedorId"',
          'SUM(l.cantidadInicialKg) AS "cantidadKg"',
        ])
        .groupBy('p.id')
        .orderBy('"cantidadKg"', 'DESC')
        .limit(top);

      const topRows = await topQb.getRawMany<{
        proveedorId: string;
        cantidadKg: string;
      }>();
      topIds = topRows.map((r) => r.proveedorId).filter(Boolean);
    }

    // ----------------------------
    // 2) Query principal por periodo + proveedor
    // ----------------------------
    const bucketExpr = `DATE_TRUNC('${periodo}', r.fechaRemito)`;

    const qb = this.recepcionRepo
      .createQueryBuilder('r')
      .leftJoin('r.proveedor', 'p')
      .leftJoin('r.lotes', 'l')
      .where('r.tenantId = :tenantId', { tenantId });

    if (q.desde) qb.andWhere('r.fechaRemito >= :desde', { desde: q.desde });
    if (q.hasta) qb.andWhere('r.fechaRemito <= :hasta', { hasta: q.hasta });

    if (q.proveedorId) {
      qb.andWhere('p.id = :pid', { pid: q.proveedorId });
    } else if (topIds && topIds.length > 0 && !incluirOtros) {
      qb.andWhere('p.id IN (:...topIds)', { topIds });
    }

    qb.select([
      `${bucketExpr} AS "periodo"`,
      `p.id AS "proveedorId"`,
      `p.nombre AS "proveedorNombre"`, // 👈 si es razonSocial, cambiá acá
      `COALESCE(SUM(l.cantidadInicialKg), 0) AS "cantidadKg"`,
      `COUNT(DISTINCT r.id) AS "recepciones"`,
    ])
      .groupBy('"periodo"')
      .addGroupBy('p.id')
      .addGroupBy('p.nombre')
      .orderBy('"periodo"', 'ASC')
      .addOrderBy('p.nombre', 'ASC');

    const rows = await qb.getRawMany<{
      periodo: any;
      proveedorId: string;
      proveedorNombre: string;
      cantidadKg: string;
      recepciones: string;
    }>();

    const normalized: SerieProveedorRow[] = rows.map((r) => ({
      periodo: new Date(r.periodo as any).toISOString(),
      proveedorId: r.proveedorId,
      proveedorNombre: r.proveedorNombre,
      cantidadKg: Number(r.cantidadKg ?? 0),
      recepciones: Number(r.recepciones ?? 0),
    }));

    // ----------------------------
    // 3) Si vino proveedorId → devolvemos directo
    // ----------------------------
    if (q.proveedorId) {
      return {
        periodo,
        desde: q.desde ?? null,
        hasta: q.hasta ?? null,
        top: null,
        incluirOtros: false,
        items: normalized,
      };
    }

    // ----------------------------
    // 4) Top + OTROS (por periodo)
    // ----------------------------
    if (!topIds || topIds.length === 0) {
      return {
        periodo,
        desde: q.desde ?? null,
        hasta: q.hasta ?? null,
        top,
        incluirOtros,
        items: [],
      };
    }

    if (!incluirOtros) {
      return {
        periodo,
        desde: q.desde ?? null,
        hasta: q.hasta ?? null,
        top,
        incluirOtros: false,
        items: normalized,
      };
    }

    const topSet = new Set(topIds);
    const topRows = normalized.filter((r) => topSet.has(r.proveedorId ?? ''));
    const restRows = normalized.filter((r) => !topSet.has(r.proveedorId ?? ''));

    const otrosByPeriodo = new Map<string, { kg: number; rec: number }>();
    for (const r of restRows) {
      const cur = otrosByPeriodo.get(r.periodo) ?? { kg: 0, rec: 0 };
      cur.kg += r.cantidadKg;
      cur.rec += r.recepciones;
      otrosByPeriodo.set(r.periodo, cur);
    }

    const otrosRows: SerieProveedorRow[] = Array.from(otrosByPeriodo.entries())
      .filter(([, v]) => v.kg > 0 || v.rec > 0)
      .map(([periodoIso, v]) => ({
        periodo: periodoIso,
        proveedorId: null,
        proveedorNombre: 'OTROS',
        cantidadKg: Number(v.kg.toFixed(6)),
        recepciones: v.rec,
      }));

    return {
      periodo,
      desde: q.desde ?? null,
      hasta: q.hasta ?? null,
      top,
      incluirOtros: true,
      items: [...topRows, ...otrosRows].sort((a, b) => {
        const ta = new Date(a.periodo).getTime();
        const tb = new Date(b.periodo).getTime();
        if (ta !== tb) return ta - tb;
        return a.proveedorNombre.localeCompare(b.proveedorNombre);
      }),
    };
  }
}
