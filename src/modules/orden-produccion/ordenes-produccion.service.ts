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

    orden.estado = 'procesando';
    await this.ordenRepo.save(orden);

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

    const codigoLote = `PF-${new Date().toISOString().slice(0, 10)}-${orden.id.slice(-4)}`;

    const loteFinal = this.lotePFRepo.create({
      tenantId,
      codigoLote,
      fechaProduccion: new Date(),
      deposito,
      cantidadInicialKg: orden.cantidadKg,
      cantidadActualKg: orden.cantidadKg,
      estado: LotePfEstado.RETENIDO,
      fechaEstado: new Date(),
      motivoEstado: 'Creado por producción (pendiente de liberación)',
    });

    await this.lotePFRepo.save(loteFinal);

    // Movimiento ingreso
    await this.stockService.ingresoLotePF?.(
      tenantId,
      loteFinal.id,
      orden.cantidadKg,
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
  }

  /** ============================
   *  OBTENER ORDEN COMPLETA
   ============================ */
  async obtener(tenantId: string, ordenId: string) {
    return this.ordenRepo.findOne({
      where: { id: ordenId, tenantId },
      relations: [
        'recetaVersion',
        'ingredientes',
        'ingredientes.materiaPrima',
        'ingredientes.consumos',
        'ingredientes.consumos.lote',
        'loteFinal',
      ],
    });
  }

  /** ============================
   *  LISTAR ORDENES
   ============================ */
  listar(tenantId: string) {
    return this.ordenRepo.find({
      where: { tenantId },
      relations: ['recetaVersion', 'loteFinal', 'ingredientes'],
    });
  }
}
