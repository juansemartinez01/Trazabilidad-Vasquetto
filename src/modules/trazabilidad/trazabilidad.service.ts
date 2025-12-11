import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { LoteMP } from '../lotes/entities/lote-mp.entity';
import { LoteProductoFinal } from '../lotes/entities/lote-producto-final.entity';
import { OrdenProduccion } from '../orden-produccion/entities/orden-produccion.entity';
import { OrdenConsumo } from '../orden-produccion/entities/orden-consumo.entity';
import { EntregaItem } from '../entregas/entities/entrega-item.entity';
import { Cliente } from '../clientes/entities/cliente.entity';

@Injectable()
export class TrazabilidadService {
  constructor(
    @InjectRepository(LoteMP) private loteMPRepo: Repository<LoteMP>,
    @InjectRepository(LoteProductoFinal)
    private lotePFRepo: Repository<LoteProductoFinal>,
    @InjectRepository(OrdenProduccion)
    private ordenRepo: Repository<OrdenProduccion>,
    @InjectRepository(OrdenConsumo)
    private consumoRepo: Repository<OrdenConsumo>,
    @InjectRepository(EntregaItem)
    private entregaItemRepo: Repository<EntregaItem>,
    @InjectRepository(Cliente) private clienteRepo: Repository<Cliente>,
  ) {}

  /** ========================================================
   *  TRAZABILIDAD DE LOTE FINAL → BACKWARD Y FORWARD
   ======================================================== */
  async trazabilidadPF(tenantId: string, loteId: string) {
    const lote = await this.lotePFRepo.findOne({
      where: { id: loteId, tenantId },
      relations: ['deposito'],
    });

    if (!lote) throw new NotFoundException('Lote final no encontrado');

    // Orden de producción asociada
    const orden = await this.ordenRepo.findOne({
      where: { loteFinal: { id: loteId }, tenantId },
      relations: ['recetaVersion', 'responsable'],
    });

    // Consumos de MP usados en esta orden
    const consumos = orden
      ? await this.consumoRepo.find({
          where: { tenantId, ingrediente: { orden: { id: orden.id } } },
          relations: ['ingrediente', 'ingrediente.materiaPrima', 'lote'],
        })
      : [];

    // Entregas forward
    const entregas = await this.entregaItemRepo.find({
      where: { tenantId, lote: { id: loteId } },
      relations: ['entrega', 'entrega.cliente', 'deposito'],
    });

    return {
      loteFinal: lote,
      produccion: orden,
      consumos,
      entregas,
    };
  }

  /** ========================================================
   *  TRAZABILIDAD DE LOTE DE MP → FORWARD
   ======================================================== */
  async trazabilidadMP(tenantId: string, loteId: string) {
    const lote = await this.loteMPRepo.findOne({
      where: { id: loteId, tenantId },
      relations: [
        'materiaPrima',
        'deposito',
        'recepcion',
        'recepcion.proveedor',
      ],
    });

    if (!lote) throw new NotFoundException('Lote de MP no encontrado');

    // Órdenes donde fue usado este lote
    const consumos = await this.consumoRepo.find({
      where: { tenantId, lote: { id: loteId } },
      relations: [
        'ingrediente',
        'ingrediente.materiaPrima',
        'ingrediente.orden',
        'ingrediente.orden.loteFinal',
      ],
    });

    // Buscar entregas de los lotes finales generados
    const entregas = await this.entregaItemRepo.find({
      where: { tenantId },
      relations: ['lote', 'entrega', 'entrega.cliente'],
    });

    // Filtrar entregas solo de PF creados a partir de órdenes que usaron esta MP
    const entregasFiltradas = entregas.filter((e) =>
      consumos.some((c) => c.ingrediente.orden.loteFinal?.id === e.lote.id),
    );

    return {
      loteMP: lote,
      consumos,
      entregas: entregasFiltradas,
    };
  }

  /** ========================================================
   *  TRAZABILIDAD POR CLIENTE
   ======================================================== */
  async trazabilidadCliente(tenantId: string, clienteId: string) {
    const cliente = await this.clienteRepo.findOne({
      where: { id: clienteId, tenantId },
    });

    if (!cliente) throw new NotFoundException('Cliente no encontrado');

    const entregas = await this.entregaItemRepo.find({
      where: { tenantId, entrega: { cliente: { id: clienteId } } },
      relations: ['lote', 'entrega', 'entrega.cliente'],
    });

    return {
      cliente,
      entregas,
    };
  }

  /** ========================================================
   *  BUSCADOR UNIFICADO (cualquier ID)
   ======================================================== */
  async buscar(tenantId: string, id: string) {
    if (await this.lotePFRepo.findOne({ where: { id, tenantId } }))
      return { tipo: 'lotePF', ...(await this.trazabilidadPF(tenantId, id)) };

    if (await this.loteMPRepo.findOne({ where: { id, tenantId } }))
      return { tipo: 'loteMP', ...(await this.trazabilidadMP(tenantId, id)) };

    if (await this.clienteRepo.findOne({ where: { id, tenantId } }))
      return {
        tipo: 'cliente',
        ...(await this.trazabilidadCliente(tenantId, id)),
      };

    throw new NotFoundException('No se encontró trazabilidad para este ID');
  }
}
