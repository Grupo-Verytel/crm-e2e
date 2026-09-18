import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomUUID } from 'crypto';
import type { Transaction } from 'sequelize';
import { User } from '../../auth/models/user.model';
import type { CrearOuvInteraccionDto } from '../dtos/ouv-interaccion.dto';
import type {
  OuvInteraccionHiloResponseDto,
  OuvInteraccionResponseDto,
} from '../dtos/ouv-response.dto';
import { canReadOuv } from '../lib/ouv-access';
import { OuvResultado, OuvZona } from '../models/enums/ouv.enums';
import { OuvInteraction } from '../models/ouv-interaction.model';
import { OuvInteractionReply } from '../models/ouv-interaction-reply.model';
import { Ouv } from '../models/ouv.model';

const OUV_ZONA_LABEL: Record<OuvZona, string> = {
  [OuvZona.Universo]: 'Universo',
  [OuvZona.EncimaFunnel]: 'Encima Funnel',
  [OuvZona.EnFunnel]: 'En Funnel',
  [OuvZona.MayorProbabilidad]: 'Mayor Probabilidad',
};

export type RegistrarCierreInput = {
  ouv: Ouv;
  resultado: OuvResultado.Perdida | OuvResultado.Descartada;
  motivoNombre: string;
  motivoDetalle: string | null;
  actorUserId: string;
};

/**
 * Bitácora de interacciones OUV: alta, listado y borrado. Sin edición: el
 * historial es un registro; corregir se hace agregando una entrada nueva o
 * respondiendo el hilo. Igual criterio que en `won_sale_history`.
 */
@Injectable()
export class OuvInteraccionesService {
  constructor(
    @InjectModel(Ouv) private readonly ouvModel: typeof Ouv,
    @InjectModel(OuvInteraction)
    private readonly interactionModel: typeof OuvInteraction,
    @InjectModel(OuvInteractionReply)
    private readonly replyModel: typeof OuvInteractionReply,
    @InjectModel(User) private readonly userModel: typeof User,
  ) {}

  async listByOuv(
    ouvId: string,
    actorUserId: string,
    actorRoleName: string,
  ): Promise<OuvInteraccionResponseDto[]> {
    const ouv = await this.ouvModel.findByPk(ouvId);
    if (!ouv) {
      throw new NotFoundException(`OUV ${ouvId} not found`);
    }
    if (!canReadOuv(ouv.comercialId, actorUserId, actorRoleName)) {
      throw new ForbiddenException('Not allowed to view this OUV');
    }

    const rows = await this.interactionModel.findAll({
      where: { ouvId },
      include: [{ model: OuvInteractionReply, as: 'hilos' }],
      order: [
        ['fechaRegistrada', 'DESC'],
        ['createdAt', 'DESC'],
        [{ model: OuvInteractionReply, as: 'hilos' }, 'fechaRegistrada', 'ASC'],
      ],
    });

    return rows.map((row) => this.presentInteraction(row));
  }

  async crear(
    ouvId: string,
    dto: CrearOuvInteraccionDto,
    actorUserId: string,
    actorRoleName: string,
  ): Promise<OuvInteraccionResponseDto> {
    return this.ouvModel.sequelize!.transaction(async (transaction) => {
      const ouv = await this.lockOuvForWrite(
        ouvId,
        actorUserId,
        actorRoleName,
        transaction,
      );

      const actorNombre = await this.resolveDisplayName(actorUserId);
      const now = new Date();

      const interaction = await this.interactionModel.create(
        {
          ouvInteractionId: randomUUID(),
          ouvId: ouv.ouvId,
          titulo: dto.titulo.trim(),
          observaciones: dto.observaciones?.trim() || null,
          registradoPorId: actorUserId,
          registradoPorNombre: actorNombre,
          fechaRegistrada: now,
        },
        { transaction },
      );

      return this.presentInteraction(
        Object.assign(interaction, { hilos: [] as OuvInteractionReply[] }),
      );
    });
  }

  /**
   * Deja en la bitácora el cierre de la OUV como Perdida o Descartada, con
   * motivo, observaciones y zona como etiquetas.
   *
   * Corre dentro de la transacción del cierre (`OuvsService.perder` /
   * `descartar`), que ya validó dueño y estado. No pasa por `lockOuvForWrite`
   * porque la OUV queda cerrada en esa misma transacción.
   */
  async registrarCierre(
    input: RegistrarCierreInput,
    transaction: Transaction,
  ): Promise<void> {
    const perdida = input.resultado === OuvResultado.Perdida;
    const zonaLabel =
      OUV_ZONA_LABEL[input.ouv.zonaActual] ?? input.ouv.zonaActual;

    await this.interactionModel.create(
      {
        ouvInteractionId: randomUUID(),
        ouvId: input.ouv.ouvId,
        titulo: `${perdida ? 'OUV perdida' : 'OUV descartada'} — ${input.motivoNombre}`.slice(
          0,
          200,
        ),
        observaciones: input.motivoDetalle?.trim() || null,
        etiquetas: [
          perdida ? 'OUV Perdida' : 'OUV Descartada',
          `Motivo: ${input.motivoNombre}`,
          `Zona: ${zonaLabel}`,
        ],
        registradoPorId: input.actorUserId,
        registradoPorNombre: await this.resolveDisplayName(
          input.actorUserId,
          transaction,
        ),
        fechaRegistrada: new Date(),
      },
      { transaction },
    );
  }

  async responder(
    ouvId: string,
    ouvInteractionId: string,
    dto: CrearOuvInteraccionDto,
    actorUserId: string,
    actorRoleName: string,
  ): Promise<OuvInteraccionResponseDto> {
    return this.ouvModel.sequelize!.transaction(async (transaction) => {
      const ouv = await this.lockOuvForWrite(
        ouvId,
        actorUserId,
        actorRoleName,
        transaction,
      );

      const parent = await this.interactionModel.findOne({
        where: { ouvInteractionId, ouvId: ouv.ouvId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!parent) {
        throw new NotFoundException(
          `OUV interaction ${ouvInteractionId} not found for OUV ${ouv.ouvId}`,
        );
      }

      const actorNombre = await this.resolveDisplayName(actorUserId);

      await this.replyModel.create(
        {
          ouvInteractionReplyId: randomUUID(),
          ouvInteractionId: parent.ouvInteractionId,
          titulo: dto.titulo.trim(),
          observaciones: dto.observaciones?.trim() || null,
          registradoPorId: actorUserId,
          registradoPorNombre: actorNombre,
          fechaRegistrada: new Date(),
        },
        { transaction },
      );

      const refreshed = await this.interactionModel.findByPk(
        parent.ouvInteractionId,
        {
          include: [{ model: OuvInteractionReply, as: 'hilos' }],
          transaction,
          order: [
            [
              { model: OuvInteractionReply, as: 'hilos' },
              'fechaRegistrada',
              'ASC',
            ],
          ],
        },
      );

      return this.presentInteraction(refreshed!);
    });
  }

  async eliminar(
    ouvId: string,
    ouvInteractionId: string,
    actorUserId: string,
    actorRoleName: string,
  ): Promise<void> {
    return this.ouvModel.sequelize!.transaction(async (transaction) => {
      const ouv = await this.lockOuvForWrite(
        ouvId,
        actorUserId,
        actorRoleName,
        transaction,
      );

      const interaction = await this.interactionModel.findOne({
        where: { ouvInteractionId, ouvId: ouv.ouvId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!interaction) {
        throw new NotFoundException(
          `OUV interaction ${ouvInteractionId} not found for OUV ${ouv.ouvId}`,
        );
      }

      // El `paranoid` de la tabla padre no propaga a los hijos; se hace a mano
      // para que el hilo también quede en soft delete y no reaparezca si se
      // recrea una interacción con el mismo id.
      await this.replyModel.destroy({
        where: { ouvInteractionId: interaction.ouvInteractionId },
        transaction,
      });
      await interaction.destroy({ transaction });
    });
  }

  async eliminarHilo(
    ouvId: string,
    ouvInteractionId: string,
    replyId: string,
    actorUserId: string,
    actorRoleName: string,
  ): Promise<void> {
    return this.ouvModel.sequelize!.transaction(async (transaction) => {
      const ouv = await this.lockOuvForWrite(
        ouvId,
        actorUserId,
        actorRoleName,
        transaction,
      );

      const reply = await this.replyModel.findOne({
        where: {
          ouvInteractionReplyId: replyId,
          ouvInteractionId,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!reply) {
        throw new NotFoundException(
          `Reply ${replyId} not found on interaction ${ouvInteractionId}`,
        );
      }

      // Confirmamos que la interacción padre sí pertenece a la OUV cuyo id
      // viene por URL; evita que un actor con acceso a otra OUV borre un hilo
      // ajeno adivinando el id del reply.
      const parent = await this.interactionModel.findOne({
        where: { ouvInteractionId, ouvId: ouv.ouvId },
        transaction,
      });
      if (!parent) {
        throw new NotFoundException(
          `OUV interaction ${ouvInteractionId} not found for OUV ${ouv.ouvId}`,
        );
      }

      await reply.destroy({ transaction });
    });
  }

  private async lockOuvForWrite(
    ouvId: string,
    actorUserId: string,
    actorRoleName: string,
    transaction: Transaction,
  ): Promise<Ouv> {
    const ouv = await this.ouvModel.findByPk(ouvId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!ouv) {
      throw new NotFoundException(`OUV ${ouvId} not found`);
    }

    // Admin y SoporteComercial pueden anotar en cualquier OUV; el ejecutivo
    // solo en la suya. Coherente con `assertCanReadOuv`, pero relajado en la
    // escritura: la bitácora no muta la OUV en sí.
    const admite =
      actorRoleName === 'Admin' ||
      actorRoleName === 'SoporteComercial' ||
      ouv.comercialId === actorUserId;
    if (!admite) {
      throw new ForbiddenException(
        'Only the owning Ejecutivo Comercial can log interactions on this OUV',
      );
    }

    // Una OUV cerrada (Ganada/Perdida/Descartada) se lee, no se le agregan
    // notas nuevas: el expediente queda congelado, como el resto del detalle.
    if (ouv.resultado !== OuvResultado.EnCurso) {
      throw new BadRequestException(
        `Cannot log interactions on a closed OUV (resultado=${ouv.resultado})`,
      );
    }

    return ouv;
  }

  private async resolveDisplayName(
    userId: string,
    transaction?: Transaction,
  ): Promise<string> {
    const user = await this.userModel.findByPk(userId, {
      attributes: ['userId', 'fullName'],
      transaction,
    });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    return user.fullName;
  }

  private presentInteraction(
    interaction: OuvInteraction,
  ): OuvInteraccionResponseDto {
    const hilos = (interaction.hilos ?? [])
      .slice()
      .sort(
        (a, b) =>
          a.fechaRegistrada.getTime() - b.fechaRegistrada.getTime(),
      )
      .map<OuvInteraccionHiloResponseDto>((reply) => ({
        ouv_interaction_reply_id: reply.ouvInteractionReplyId,
        titulo: reply.titulo,
        observaciones: reply.observaciones,
        fecha_registrada: reply.fechaRegistrada,
        registrado_por_id: reply.registradoPorId,
        registrado_por_nombre: reply.registradoPorNombre,
        created_at: reply.createdAt,
      }));

    return {
      ouv_interaction_id: interaction.ouvInteractionId,
      ouv_id: interaction.ouvId,
      titulo: interaction.titulo,
      observaciones: interaction.observaciones,
      etiquetas: interaction.etiquetas ?? [],
      fecha_registrada: interaction.fechaRegistrada,
      registrado_por_id: interaction.registradoPorId,
      registrado_por_nombre: interaction.registradoPorNombre,
      created_at: interaction.createdAt,
      hilos,
    };
  }
}
