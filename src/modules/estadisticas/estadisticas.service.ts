import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoteProductoFinal } from '../lotes/entities/lote-producto-final.entity';
import { QueryEstadisticasProduccionDto } from './dto/query-estadisticas-produccion.dto';
import { QueryTortaProduccionDto } from './dto/query-torta-produccion.dto';


type TortaProduccionItem = {
  productoFinalId: string | null;
  productoFinalNombre: string;
  cantidadKg: number;
  porcentaje: number;
};



@Injectable()
export class EstadisticasService {
  constructor(
    @InjectRepository(LoteProductoFinal)
    private readonly lotePfRepo: Repository<LoteProductoFinal>,
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
}
