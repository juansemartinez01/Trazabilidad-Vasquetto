import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrdenProduccion } from './entities/orden-produccion.entity';
import { Receta } from '../recetas/entities/receta.entity';
import { OrdenIngrediente } from './entities/orden-ingrediente.entity';
import { OrdenConsumo } from './entities/orden-consumo.entity';
import { LotePfEstado, LoteProductoFinal } from '../lotes/entities/lote-producto-final.entity';
import { Deposito } from '../deposito/entities/deposito.entity';
import { StockService } from '../stock-movimiento/stock.service';
import { TipoMovimiento } from '../stock-movimiento/entities/stock-movimiento.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Usuario } from '../usuarios/entities/usuarios.entity';

@Injectable()
export class OrdenesProduccionService {
  constructor(
    @InjectRepository(OrdenProduccion)
    private ordenRepo: Repository<OrdenProduccion>,
    @InjectRepository(OrdenIngrediente)
    private ingRepo: Repository<OrdenIngrediente>,
    @InjectRepository(OrdenConsumo)
    private consumoRepo: Repository<OrdenConsumo>,
    @InjectRepository(Receta) private recetaRepo: Repository<Receta>,
    @InjectRepository(LoteProductoFinal)
    private lotePFRepo: Repository<LoteProductoFinal>,
    @InjectRepository(Deposito) private depRepo: Repository<Deposito>,
    private stockService: StockService,
    private auditoria: AuditoriaService,
    @InjectRepository(Usuario) private usuariosRepo: Repository<Usuario>,
  ) {}

  /** ============================
   *  CREAR ORDEN
   ============================ */
  async crear(tenantId: string, usuarioId: string, dto: any) {
    const receta = await this.recetaRepo.findOne({
      where: { id: dto.recetaId, tenantId },
      relations: [
        'versiones',
        'versiones.ingredientes',
        'versiones.ingredientes.materiaPrima',
      ],
    });

    if (!receta) throw new NotFoundException('Receta no encontrada');

    const version = receta.versiones.find((v) => v.activa);
    if (!version)
      throw new BadRequestException('La receta no tiene versión activa');

    const orden = this.ordenRepo.create({
      tenantId,
      cantidadKg: dto.cantidadKg,
      recetaVersion: version,
      responsable: { id: dto.responsableId },
      estado: 'pendiente',
      observaciones: dto.observaciones,
    });

    await this.ordenRepo.save(orden);

    // Crear ingredientes teóricos
    for (const ing of version.ingredientes) {
      const kg = (dto.cantidadKg * ing.porcentaje) / 100;

      await this.ingRepo.save(
        this.ingRepo.create({
          tenantId,
          orden,
          materiaPrima: ing.materiaPrima,
          porcentaje: ing.porcentaje,
          kgNecesarios: kg,
        }),
      );
    }

    await this.auditoria.registrar(
      tenantId,
      usuarioId,
      'ORDEN_PRODUCCION_CREADA',
      { ordenId: orden.id },
    );

    return this.obtener(tenantId, orden.id);
  }

  /** ============================
 *  PROCESAR ORDEN (CONSUMO FEFO + LOTE FINAL)
 ============================ */
  async procesar(
    tenantId: string,
    usuarioId: string,
    ordenId: string,
    depositoDestinoId: string,
  ) {
    const orden = await this.obtener(tenantId, ordenId);

    if (!orden) {
      throw new NotFoundException('Orden no encontrada');
    }

    if (orden.estado !== 'pendiente') {
      throw new BadRequestException('La orden ya fue procesada');
    }

    const cantidadKg = Number(orden.cantidadKg);
    if (!Number.isFinite(cantidadKg) || cantidadKg <= 0) {
      throw new BadRequestException('La cantidadKg de la orden debe ser > 0');
    }

    // (Pulido pro) validar responsable para evitar FK responsable_id
    const responsableId = orden?.responsable?.id;
    if (!responsableId) {
      throw new BadRequestException('La orden no tiene responsable asignado');
    }
    const responsableOk = await this.usuariosRepo.findOne({
      where: { id: responsableId, tenantId },
    });
    if (!responsableOk) {
      throw new BadRequestException('Responsable inválido');
    }

    orden.estado = 'procesando';
    await this.ordenRepo.save(orden);

    let loteFinalId: string | null = null;

    try {
      // 1. CONSUMIR INGREDIENTES APLICANDO FEFO
      for (const ing of orden.ingredientes) {
        const lotesFEFO = await this.stockService.obtenerLotesFEFO(
          tenantId,
          ing.materiaPrima.id,
          ing.kgNecesarios,
        );

        for (const lote of lotesFEFO) {
          // Descontar stock
          await this.stockService.consumirLote(
            tenantId,
            lote.lote.id,
            lote.cantidad,
            TipoMovimiento.PRODUCCION_CONSUMO,
            orden.id,
          );

          // Registrar trazabilidad real
          await this.consumoRepo.save(
            this.consumoRepo.create({
              tenantId,
              ingrediente: ing,
              lote: lote.lote,
              cantidadKg: lote.cantidad,
            }),
          );
        }
      }

      // 2. CREAR LOTE FINAL
      const deposito = await this.depRepo.findOne({
        where: { id: depositoDestinoId, tenantId },
      });

      if (!deposito) {
        throw new NotFoundException('Depósito no encontrado');
      }

      // Normalizamos fecha "date" (sin hora) para que Postgres guarde bien
      const fechaProduccion = new Date();
      fechaProduccion.setHours(0, 0, 0, 0);

      const codigoLote = `PF-${fechaProduccion
        .toISOString()
        .slice(0, 10)}-${orden.id.slice(-4)}`;

      const productoFinal = orden.recetaVersion?.receta?.productoFinal;
      if (!productoFinal) {
        throw new BadRequestException(
          'La receta no tiene ProductoFinal asignado (productoFinalId).',
        );
      }

      // Calcular vencimiento si hay vida útil
      let fechaVencimiento: Date | null = null;
      if (productoFinal.vidaUtilDias != null) {
        const vida = Number(productoFinal.vidaUtilDias);
        if (Number.isNaN(vida) || vida <= 0) {
          throw new BadRequestException(
            `vidaUtilDias inválida para el producto final ${productoFinal.codigo}`,
          );
        }

        fechaVencimiento = new Date(fechaProduccion);
        fechaVencimiento.setDate(fechaVencimiento.getDate() + vida);
      }

      const loteFinal = this.lotePFRepo.create({
        tenantId,
        codigoLote,
        fechaProduccion,
        fechaVencimiento,
        deposito,
        cantidadInicialKg: cantidadKg, // ✅
        cantidadActualKg: cantidadKg, // ✅
        estado: LotePfEstado.RETENIDO,
        fechaEstado: new Date(),
        motivoEstado:
          productoFinal.vidaUtilDias == null
            ? 'Creado por producción (vida útil no definida)'
            : 'Creado por producción (pendiente de liberación)',
        productoFinal,
      });

      await this.lotePFRepo.save(loteFinal);
      loteFinalId = loteFinal.id;

      // Movimiento ingreso
      await this.stockService.ingresoLotePF(
        tenantId,
        loteFinal.id,
        cantidadKg, // ✅
        orden.id,
      );

      orden.estado = 'finalizada';
      orden.loteFinal = loteFinal;
      await this.ordenRepo.save(orden);

      await this.auditoria.registrar(
        tenantId,
        usuarioId,
        'ORDEN_PRODUCCION_FINALIZADA',
        { ordenId: orden.id },
      );

      return this.obtener(tenantId, orden.id);
    } catch (e) {
      if (loteFinalId) {
        await this.lotePFRepo.delete({ id: loteFinalId, tenantId });
      }
      orden.estado = 'pendiente';
      await this.ordenRepo.save(orden);
      throw e;
    }
  }

  /** ============================
   *  OBTENER ORDEN COMPLETA
   ============================ */
  async obtener(tenantId: string, ordenId: string) {
    return this.ordenRepo.findOne({
      where: { id: ordenId, tenantId },
      relations: [
        'recetaVersion',
        'recetaVersion.receta',
        'recetaVersion.receta.productoFinal',
        'ingredientes',
        'ingredientes.materiaPrima',
        'ingredientes.consumos',
        'ingredientes.consumos.lote',
        'loteFinal',

        'loteFinal.productoFinal',
      ],
    });
  }

  /** ============================
   *  LISTAR ORDENES
   ============================ */
  listar(tenantId: string) {
    return this.ordenRepo.find({
      where: { tenantId },
      relations: [
        'recetaVersion',
        'recetaVersion.receta',
        'recetaVersion.receta.productoFinal',
        'ingredientes',
        'ingredientes.materiaPrima',
        'loteFinal',
        'loteFinal.productoFinal',
      ],
    });
  }
}
