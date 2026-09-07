import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import type { Transaction } from 'sequelize';
import { GraphService } from '../../graph-integration/services/graph.service';
import {
  KickoffApprovalResponseDto,
  KickoffEnvelopeDto,
  KickoffInviteeResponseDto,
  KickoffResponseDto,
  SaveKickoffDto,
} from '../dtos/kickoff.dto';
import { Kickoff, KickoffApproval, KickoffInvitee } from '../models';

function toIso(value: Date | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Kickoff de una venta ganada, persistido en MySQL.
 *
 * El `PUT` reemplaza el registro completo (incluidos invitados y aprobaciones)
 * porque el modal del frontend edita el kickoff como una sola unidad; hacerlo
 * en una transacción evita dejar hijos huérfanos si algo falla a mitad.
 */
@Injectable()
export class KickoffService {
  private readonly logger = new Logger(KickoffService.name);

  constructor(
    @InjectModel(Kickoff) private readonly kickoffModel: typeof Kickoff,
    @InjectModel(KickoffInvitee)
    private readonly inviteeModel: typeof KickoffInvitee,
    @InjectModel(KickoffApproval)
    private readonly approvalModel: typeof KickoffApproval,
    private readonly graphService: GraphService,
  ) {}

  async getByOuv(ouvId: string): Promise<KickoffEnvelopeDto> {
    const kickoff = await this.findWithChildren(ouvId);
    return { kickoff: kickoff ? this.toResponse(kickoff) : null };
  }

  async save(
    ouvId: string,
    dto: SaveKickoffDto,
    userId: string | null,
  ): Promise<KickoffResponseDto> {
    const saved = await this.kickoffModel.sequelize!.transaction(
      async (transaction) => {
        const existing = await this.kickoffModel.findOne({
          where: { ouvId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        const values = {
          ouvId,
          name: dto.name.trim(),
          startsAt: toDate(dto.startsAt),
          endsAt: toDate(dto.endsAt),
          timeZone: dto.timeZone?.trim() || 'America/Bogota',
          locationTypes: dto.locationTypes,
          roomEmail: dto.roomEmail ?? null,
          roomLabel: dto.roomLabel ?? null,
          locationDetail: dto.locationDetail ?? null,
          notes: dto.notes ?? null,
          status: dto.status,
          schedulingConfirmed: dto.schedulingConfirmed,
          teamsValidated: dto.teamsValidated,
          heldAt: toDate(dto.heldAt),
          graphEventId: dto.graphEventId ?? null,
          graphOrganizerUpn: dto.graphOrganizerUpn ?? null,
          joinUrl: dto.joinUrl ?? null,
          webLink: dto.webLink ?? null,
          confirmedAt: toDate(dto.confirmedAt),
          updatedBy: userId,
        };

        const kickoff = existing
          ? await existing.update(values, { transaction })
          : await this.kickoffModel.create(
              { ...values, createdBy: userId },
              { transaction },
            );

        await this.replaceChildren(kickoff.kickoffId, dto, transaction);
        return kickoff.kickoffId;
      },
    );

    const kickoff = await this.findWithChildren(ouvId);
    if (!kickoff) {
      throw new NotFoundException(
        `Kickoff ${saved} no encontrado tras guardar`,
      );
    }
    return this.toResponse(kickoff);
  }

  /**
   * Elimina el kickoff de la OUV y cancela el evento en Microsoft 365 si lo
   * hubiera. La cancelación es best-effort: si Graph falla, el registro local
   * se borra igual y queda el aviso en el log — de lo contrario el usuario se
   * quedaría sin poder limpiar la pantalla.
   */
  async remove(ouvId: string): Promise<void> {
    const kickoff = await this.kickoffModel.findOne({ where: { ouvId } });
    if (!kickoff) {
      throw new NotFoundException(`La OUV ${ouvId} no tiene kickoff agendado`);
    }

    if (kickoff.graphEventId) {
      try {
        await this.graphService.cancelMeeting(
          kickoff.graphEventId,
          kickoff.graphOrganizerUpn ?? undefined,
        );
      } catch (error) {
        this.logger.warn(
          `No se pudo cancelar en Graph el evento ${kickoff.graphEventId} de la OUV ${ouvId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    await this.inviteeModel.destroy({
      where: { kickoffId: kickoff.kickoffId },
    });
    await this.approvalModel.destroy({
      where: { kickoffId: kickoff.kickoffId },
    });
    await kickoff.destroy();
  }

  private async replaceChildren(
    kickoffId: string,
    dto: SaveKickoffDto,
    transaction: Transaction,
  ): Promise<void> {
    // `force: true` en los hijos: son una foto del estado actual del kickoff,
    // no historia que valga la pena conservar como soft-delete.
    await this.inviteeModel.destroy({
      where: { kickoffId },
      force: true,
      transaction,
    });
    await this.approvalModel.destroy({
      where: { kickoffId },
      force: true,
      transaction,
    });

    if (dto.invitees.length > 0) {
      await this.inviteeModel.bulkCreate(
        dto.invitees.map((invitee) => ({
          kickoffId,
          email: invitee.email.trim(),
          displayName: invitee.displayName.trim(),
          inviteeType: invitee.inviteeType,
          sourceRef: invitee.sourceRef ?? null,
        })),
        { transaction },
      );
    }

    if (dto.approvals.length > 0) {
      await this.approvalModel.bulkCreate(
        dto.approvals.map((approval) => ({
          kickoffId,
          code: approval.code,
          label: approval.label,
          completed: approval.completed,
          completedAt: approval.completed ? new Date() : null,
        })),
        { transaction },
      );
    }
  }

  private findWithChildren(ouvId: string): Promise<Kickoff | null> {
    return this.kickoffModel.findOne({
      where: { ouvId },
      include: [
        { model: KickoffInvitee, required: false },
        { model: KickoffApproval, required: false },
      ],
      order: [
        [{ model: KickoffApproval, as: 'approvals' }, 'created_at', 'ASC'],
      ],
    });
  }

  private toResponse(kickoff: Kickoff): KickoffResponseDto {
    const invitees: KickoffInviteeResponseDto[] = (kickoff.invitees ?? []).map(
      (invitee) => ({
        kickoffInviteeId: invitee.kickoffInviteeId,
        email: invitee.email,
        displayName: invitee.displayName,
        inviteeType: invitee.inviteeType,
        sourceRef: invitee.sourceRef,
      }),
    );

    const approvals: KickoffApprovalResponseDto[] = (
      kickoff.approvals ?? []
    ).map((approval) => ({
      kickoffApprovalId: approval.kickoffApprovalId,
      code: approval.code,
      label: approval.label,
      completed: approval.completed,
      completedAt: toIso(approval.completedAt),
    }));

    return {
      kickoffId: kickoff.kickoffId,
      ouvId: kickoff.ouvId,
      name: kickoff.name,
      startsAt: toIso(kickoff.startsAt),
      endsAt: toIso(kickoff.endsAt),
      timeZone: kickoff.timeZone,
      locationTypes: kickoff.locationTypes ?? [],
      roomEmail: kickoff.roomEmail,
      roomLabel: kickoff.roomLabel,
      locationDetail: kickoff.locationDetail,
      notes: kickoff.notes,
      status: kickoff.status,
      schedulingConfirmed: kickoff.schedulingConfirmed,
      teamsValidated: kickoff.teamsValidated,
      heldAt: toIso(kickoff.heldAt),
      graphEventId: kickoff.graphEventId,
      graphOrganizerUpn: kickoff.graphOrganizerUpn,
      joinUrl: kickoff.joinUrl,
      webLink: kickoff.webLink,
      confirmedAt: toIso(kickoff.confirmedAt),
      invitees,
      approvals,
      createdAt: new Date(kickoff.createdAt).toISOString(),
      updatedAt: new Date(kickoff.updatedAt).toISOString(),
    };
  }
}
