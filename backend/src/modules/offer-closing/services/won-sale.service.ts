import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, type Transaction } from 'sequelize';
import {
  assertCanReachOuvChild,
  canReachOuvChild,
} from '../../discovery/lib/ouv-access';
import { OuvsService } from '../../discovery/services/ouvs.service';
import { conReintentoPorDeadlock } from '../lib/deadlock-retry';
import {
  SaveWonSaleDto,
  WonSaleEnvelopeDto,
  WonSaleListDto,
  WonSaleMiembroDto,
  WonSaleResponseDto,
} from '../dtos/won-sale.dto';
import { formatNit } from '../lib/nit';
import {
  JointVenture,
  Partner,
  WonSale,
  WonSaleAlert,
  WonSaleHistoryEntry,
  WonSaleMember,
  WonSaleValidation,
} from '../models';
import type { EmpresaEjecutora } from '../models';
import { ExecutingCompanyService } from './executing-company.service';

/** Quien hace la petición; el expediente comprueba su acceso a la OUV. */
export type OuvActor = { userId: string; roleName: string };

function toIso(value: Date | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** MySQL devuelve DECIMAL como cadena para no perder precisión. */
function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Décimas de punto: 33.3 → 333. Evita sumar flotantes al validar el 100%. */
function toDecimas(pct: number | string): number {
  return Math.round(toNumber(pct) * 10);
}

/** Filas de empresa ejecutora con el nombre ya resuelto desde su catálogo. */
type MiembroValidado = WonSaleMiembroDto & {
  jointVentureId: string | null;
  partnerId: string | null;
};

/** El miembro con su UT o aliado, para validar y para responder. */
const MEMBER_INCLUDE = {
  model: WonSaleMember,
  required: false,
  include: [
    { model: JointVenture, required: false, paranoid: false },
    { model: Partner, required: false, paranoid: false },
  ],
};

/**
 * Expediente de cierre de una venta ganada, persistido en MySQL.
 *
 * El `PUT` reemplaza el registro completo porque la pantalla edita el
 * expediente como una sola unidad. La excepción es la bitácora: sus filas son
 * historia, así que solo se añaden las que llegan nuevas.
 */
@Injectable()
export class WonSaleService {
  constructor(
    @InjectModel(WonSale) private readonly wonSaleModel: typeof WonSale,
    @InjectModel(WonSaleValidation)
    private readonly validationModel: typeof WonSaleValidation,
    @InjectModel(WonSaleMember)
    private readonly memberModel: typeof WonSaleMember,
    @InjectModel(WonSaleAlert)
    private readonly alertModel: typeof WonSaleAlert,
    @InjectModel(WonSaleHistoryEntry)
    private readonly historyModel: typeof WonSaleHistoryEntry,
    private readonly ouvsService: OuvsService,
    private readonly executingCompanies: ExecutingCompanyService,
  ) {}

  /**
   * El expediente hereda el control de acceso de su OUV.
   *
   * El permiso CASL solo dice qué puede hacer un rol; no dice sobre qué OUV.
   * Sin esta comprobación, un ejecutivo comercial podía leer y editar por API
   * el expediente de una oportunidad que no le pertenece, aunque la propia OUV
   * le devolviera 403.
   */
  private async assertPuedeVerOuv(
    ouvId: string,
    actor: OuvActor,
  ): Promise<void> {
    const comercialId = await this.ouvsService.getComercialId(ouvId);
    assertCanReachOuvChild(comercialId, actor.userId, actor.roleName);
  }

  async getByOuv(ouvId: string, actor: OuvActor): Promise<WonSaleEnvelopeDto> {
    await this.assertPuedeVerOuv(ouvId, actor);
    const wonSale = await this.findWithChildren(ouvId);
    return { wonSale: wonSale ? this.toResponse(wonSale) : null };
  }

  /**
   * Expedientes de un conjunto de OUV. La bandeja de `/offers` la usa para
   * pintar el estado real de cada venta sin depender del navegador.
   *
   * Sin `ouvIds` no devuelve nada: obliga a que quien llama acote la consulta
   * a las OUV que ya puede ver, en vez de exponer la tabla entera.
   */
  async listByOuvIds(
    ouvIds: string[],
    actor: OuvActor,
  ): Promise<WonSaleListDto> {
    const pedidos = [...new Set(ouvIds.map((id) => id.trim()).filter(Boolean))];
    if (pedidos.length === 0) return { wonSales: [] };

    // Se descartan en silencio las OUV que el usuario no puede ver: un 403
    // aquí rompería la bandeja entera por una sola fila ajena.
    const duenos = await this.ouvsService.getComercialIds(pedidos);
    const ids = pedidos.filter((ouvId) => {
      const comercialId = duenos.get(ouvId);
      return (
        comercialId !== undefined &&
        canReachOuvChild(comercialId, actor.userId, actor.roleName)
      );
    });
    if (ids.length === 0) return { wonSales: [] };

    const rows = await this.wonSaleModel.findAll({
      where: { ouvId: { [Op.in]: ids } },
      include: [
        { model: WonSaleValidation, required: false },
        MEMBER_INCLUDE,
        { model: WonSaleAlert, required: false },
        { model: WonSaleHistoryEntry, required: false },
      ],
    });

    return { wonSales: rows.map((row) => this.toResponse(row)) };
  }

  async save(
    ouvId: string,
    dto: SaveWonSaleDto,
    actor: OuvActor,
  ): Promise<WonSaleResponseDto> {
    await this.assertPuedeVerOuv(ouvId, actor);
    const userId = actor.userId;
    const miembros = await this.validarMiembros(dto.miembros);

    await conReintentoPorDeadlock(() =>
      this.wonSaleModel.sequelize!.transaction(async (transaction) => {
        const existing = await this.wonSaleModel.findOne({
          where: { ouvId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        const values = {
          ouvId,
          estadoRevision: dto.estadoRevision,
          nombreProyecto: dto.nombreProyecto.trim(),
          fechaInicio: dto.fechaInicio ?? null,
          fechaFin: dto.fechaFin ?? null,
          valorFacturar: String(dto.valorFacturar),
          costoEstimado: String(dto.costoEstimado),
          recurrente: dto.recurrente,
          tipoVenta: dto.tipoVenta,
          directorProyectoId: dto.directorProyectoId ?? null,
          directorProyectoNombre: dto.directorProyectoNombre ?? null,
          centroCostos: dto.centroCostos ?? null,
          ubv: dto.ubv ?? null,
          participacion: dto.participacion ?? null,
          participacionPct: dto.participacionPct,
          envioPmoEstado: dto.envioPmoEstado,
          envioPmoConsecutivo: dto.envioPmoConsecutivo ?? null,
          envioPmoSer: dto.envioPmoSer ?? null,
          envioPmoMotivo: dto.envioPmoMotivo ?? null,
          envioPmoEnviadoEn: toDate(dto.envioPmoEnviadoEn),
          indicadores: dto.indicadores ?? null,
          csat: dto.csat ?? null,
          updatedBy: userId,
        };

        const wonSale = existing
          ? await existing.update(values, { transaction })
          : await this.wonSaleModel.create(
              { ...values, createdBy: userId },
              { transaction },
            );

        await this.replaceChildren(
          wonSale.wonSaleId,
          dto,
          miembros,
          transaction,
        );
      }),
    );

    const wonSale = await this.findWithChildren(ouvId);
    if (!wonSale) {
      throw new NotFoundException(
        `El expediente de la OUV ${ouvId} no se encontró tras guardar`,
      );
    }
    return this.toResponse(wonSale);
  }

  /** Borrado lógico del expediente y de sus hijos. */
  async remove(ouvId: string, actor: OuvActor): Promise<void> {
    await this.assertPuedeVerOuv(ouvId, actor);
    const wonSale = await this.wonSaleModel.findOne({ where: { ouvId } });
    if (!wonSale) {
      throw new NotFoundException(`La OUV ${ouvId} no tiene expediente`);
    }

    const where = { wonSaleId: wonSale.wonSaleId };
    await this.validationModel.destroy({ where });
    await this.memberModel.destroy({ where });
    await this.alertModel.destroy({ where });
    await this.historyModel.destroy({ where });
    await wonSale.destroy();
  }

  private async replaceChildren(
    wonSaleId: string,
    dto: SaveWonSaleDto,
    miembros: MiembroValidado[],
    transaction: Transaction,
  ): Promise<void> {
    // `force: true`: validaciones, miembros y alertas son una foto del estado
    // actual, no historia que valga la pena conservar como borrado lógico.
    const where = { wonSaleId };
    await this.validationModel.destroy({ where, force: true, transaction });
    await this.memberModel.destroy({ where, force: true, transaction });
    await this.alertModel.destroy({ where, force: true, transaction });

    if (dto.validaciones.length > 0) {
      await this.validationModel.bulkCreate(
        dto.validaciones.map((v) => ({
          wonSaleId,
          tipo: v.tipo,
          estado: v.estado,
          observacion: v.observacion ?? null,
          usuario: v.usuario ?? null,
          fecha: toDate(v.fecha),
          sharepointUrl: v.sharepointUrl ?? null,
          sharepointNombre: v.sharepointNombre ?? null,
        })),
        { transaction },
      );
    }

    if (miembros.length > 0) {
      await this.memberModel.bulkCreate(
        miembros.map((m) => ({
          wonSaleId,
          refId: m.refId,
          nombre: m.nombre,
          participacionPct: String(m.participacionPct),
          empresa: m.empresa ?? null,
          jointVentureId: m.jointVentureId,
          partnerId: m.partnerId,
        })),
        { transaction },
      );
    }

    if (dto.alertas.length > 0) {
      await this.alertModel.bulkCreate(
        dto.alertas.map((a) => ({
          wonSaleId,
          refId: a.refId,
          tipo: a.tipo,
          estado: a.estado,
          descripcion: a.descripcion,
          fecha: toDate(a.fecha),
        })),
        { transaction },
      );
    }

    // La bitácora se acumula. Se comparan las filas ya guardadas para no
    // duplicar las que el frontend reenvía en cada guardado.
    if (dto.historial.length > 0) {
      const guardadas = await this.historyModel.findAll({
        where: { wonSaleId },
        transaction,
      });
      const yaEstan = new Set(
        guardadas.map(
          (h) => `${h.estado}|${h.fecha.toISOString()}|${h.origen}`,
        ),
      );

      const nuevas = dto.historial.filter((h) => {
        const fecha = toDate(h.fecha);
        if (!fecha) return false;
        return !yaEstan.has(`${h.estado}|${fecha.toISOString()}|${h.origen}`);
      });

      if (nuevas.length > 0) {
        await this.historyModel.bulkCreate(
          nuevas.map((h) => ({
            wonSaleId,
            estado: h.estado,
            fecha: toDate(h.fecha) as Date,
            origen: h.origen,
          })),
          { transaction },
        );
      }
    }
  }

  /**
   * Reglas de las filas de empresa ejecutora que valen también para un
   * borrador (el `PUT` se dispara en cada edición):
   * - una fila por empresa (DR 2026-10: por ahora un solo aliado y una UT);
   * - la UT y el aliado, si vienen, existen y están activos en su catálogo;
   * - una fila no apunta al catálogo que no le corresponde.
   *
   * La suma del 100% y que la UT/aliado estén elegidos se exigen al abrir el
   * proyecto en el PMO (`assertEmpresasEjecutorasListas`), no mientras se
   * diligencia.
   */
  private async validarMiembros(
    miembros: WonSaleMiembroDto[],
  ): Promise<MiembroValidado[]> {
    const vistos = new Set<EmpresaEjecutora>();
    for (const m of miembros) {
      if (!m.empresa) continue;
      if (vistos.has(m.empresa)) {
        throw new BadRequestException({
          code: 'DUPLICATE_EXECUTING_COMPANY',
          message: `Solo se admite una fila ${m.empresa} por proyecto`,
        });
      }
      vistos.add(m.empresa);
      if (m.jointVentureId && m.empresa !== 'UT') {
        throw new BadRequestException({
          code: 'INVALID_EXECUTING_COMPANY',
          message: `La fila ${m.empresa} no puede llevar una unión temporal`,
        });
      }
      if (m.partnerId && m.empresa !== 'Aliado') {
        throw new BadRequestException({
          code: 'INVALID_EXECUTING_COMPANY',
          message: `La fila ${m.empresa} no puede llevar un aliado`,
        });
      }
    }

    const utIds = miembros.flatMap((m) =>
      m.jointVentureId ? [m.jointVentureId] : [],
    );
    const aliadoIds = miembros.flatMap((m) =>
      m.partnerId ? [m.partnerId] : [],
    );
    const [uts, aliados] = await Promise.all([
      this.executingCompanies.namesById('UT', utIds),
      this.executingCompanies.namesById('Aliado', aliadoIds),
    ]);

    return miembros.map((m) => {
      const jointVentureId = m.jointVentureId ?? null;
      const partnerId = m.partnerId ?? null;
      let nombre = m.nombre;
      if (jointVentureId) {
        const encontrado = uts.get(jointVentureId);
        if (!encontrado) {
          throw new BadRequestException({
            code: 'JOINT_VENTURE_NOT_FOUND',
            message: 'La unión temporal elegida no existe o está inactiva',
          });
        }
        nombre = encontrado;
      }
      if (partnerId) {
        const encontrado = aliados.get(partnerId);
        if (!encontrado) {
          throw new BadRequestException({
            code: 'PARTNER_NOT_FOUND',
            message: 'El aliado elegido no existe o está inactivo',
          });
        }
        nombre = encontrado;
      }
      return { ...m, nombre, jointVentureId, partnerId };
    });
  }

  /**
   * Empresas ejecutoras completas para abrir el proyecto en el PMO: al menos
   * una fila, la UT y el aliado elegidos de su catálogo y la suma exacta de
   * 100.0%. El frontend aplica la misma regla; esta es la que no se salta.
   */
  async assertEmpresasEjecutorasListas(ouvId: string): Promise<void> {
    const wonSale = await this.wonSaleModel.findOne({
      where: { ouvId },
      include: [MEMBER_INCLUDE],
    });
    const miembros = wonSale?.miembros ?? [];
    const faltantes: string[] = [];

    if (miembros.length === 0) faltantes.push('Empresa ejecutora');
    if (miembros.some((m) => m.empresa === 'UT' && !m.jointVentureId)) {
      faltantes.push('Unión temporal');
    }
    if (miembros.some((m) => m.empresa === 'Aliado' && !m.partnerId)) {
      faltantes.push('Aliado');
    }
    const suma = miembros.reduce(
      (acc, m) => acc + toDecimas(m.participacionPct),
      0,
    );
    if (miembros.length > 0 && suma !== 1000) {
      faltantes.push(`% participación (suma ${suma / 10}%, debe ser 100%)`);
    }

    if (faltantes.length > 0) {
      throw new BadRequestException({
        code: 'EXECUTING_COMPANIES_INCOMPLETE',
        message: `Empresas ejecutoras incompletas: ${faltantes.join(', ')}`,
      });
    }
  }

  private nitDe(m: WonSaleMember): string | null {
    const catalogo = m.jointVenture ?? m.partner;
    return catalogo
      ? formatNit(catalogo.taxId, catalogo.verificationDigit)
      : null;
  }

  private findWithChildren(ouvId: string): Promise<WonSale | null> {
    return this.wonSaleModel.findOne({
      where: { ouvId },
      include: [
        { model: WonSaleValidation, required: false },
        MEMBER_INCLUDE,
        { model: WonSaleAlert, required: false },
        { model: WonSaleHistoryEntry, required: false },
      ],
      order: [
        [{ model: WonSaleHistoryEntry, as: 'historial' }, 'fecha', 'ASC'],
      ],
    });
  }

  private toResponse(wonSale: WonSale): WonSaleResponseDto {
    return {
      wonSaleId: wonSale.wonSaleId,
      ouvId: wonSale.ouvId,
      estadoRevision: wonSale.estadoRevision,
      nombreProyecto: wonSale.nombreProyecto,
      fechaInicio: wonSale.fechaInicio,
      fechaFin: wonSale.fechaFin,
      valorFacturar: toNumber(wonSale.valorFacturar),
      costoEstimado: toNumber(wonSale.costoEstimado),
      recurrente: wonSale.recurrente,
      tipoVenta: wonSale.tipoVenta,
      directorProyectoId: wonSale.directorProyectoId,
      directorProyectoNombre: wonSale.directorProyectoNombre,
      centroCostos: wonSale.centroCostos,
      ubv: wonSale.ubv,
      participacion: wonSale.participacion,
      participacionPct: toNumber(wonSale.participacionPct),
      envioPmoEstado: wonSale.envioPmoEstado,
      envioPmoConsecutivo: wonSale.envioPmoConsecutivo,
      envioPmoSer: wonSale.envioPmoSer,
      envioPmoMotivo: wonSale.envioPmoMotivo,
      envioPmoEnviadoEn: toIso(wonSale.envioPmoEnviadoEn),
      indicadores: wonSale.indicadores ?? null,
      csat: wonSale.csat ?? null,
      validaciones: (wonSale.validaciones ?? []).map((v) => ({
        wonSaleValidationId: v.wonSaleValidationId,
        tipo: v.tipo,
        estado: v.estado,
        observacion: v.observacion,
        usuario: v.usuario,
        fecha: toIso(v.fecha),
        sharepointUrl: v.sharepointUrl,
        sharepointNombre: v.sharepointNombre,
      })),
      miembros: (wonSale.miembros ?? []).map((m) => ({
        wonSaleMemberId: m.wonSaleMemberId,
        refId: m.refId,
        nombre: m.nombre,
        participacionPct: toNumber(m.participacionPct),
        empresa: m.empresa,
        jointVentureId: m.jointVentureId,
        partnerId: m.partnerId,
        nit: this.nitDe(m),
      })),
      alertas: (wonSale.alertas ?? []).map((a) => ({
        wonSaleAlertId: a.wonSaleAlertId,
        refId: a.refId,
        tipo: a.tipo,
        estado: a.estado,
        descripcion: a.descripcion,
        fecha: toIso(a.fecha),
      })),
      historial: (wonSale.historial ?? []).map((h) => ({
        wonSaleHistoryEntryId: h.wonSaleHistoryEntryId,
        estado: h.estado,
        fecha: new Date(h.fecha).toISOString(),
        origen: h.origen,
      })),
      createdAt: new Date(wonSale.createdAt).toISOString(),
      updatedAt: new Date(wonSale.updatedAt).toISOString(),
    };
  }
}
