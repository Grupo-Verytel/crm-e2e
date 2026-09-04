import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomUUID } from 'crypto';
import type { Transaction } from 'sequelize';
import { AccountsService } from '../../accounts/services/accounts.service';
import { DemandGenerationService } from '../../demand-generation/services/demand-generation.service';
import { EntityType } from '../../workflow-engine/enums/entity-type.enum';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import type {
  ActualizarOuvContactoDto,
  CrearOuvContactoDto,
} from '../dtos/ouv-contacto.dto';
import type { OuvContactoResponseDto } from '../dtos/ouv-response.dto';
import { canMutateOuvEnCurso } from '../lib/ouv-access';
import { OuvResultado } from '../models/enums/ouv.enums';
import { OuvContacto } from '../models/ouv-contacto.model';
import { OuvInfluencia } from '../models/ouv-influencia.model';
import { Ouv } from '../models/ouv.model';

@Injectable()
export class OuvContactosService {
  constructor(
    @InjectModel(Ouv) private readonly ouvModel: typeof Ouv,
    @InjectModel(OuvContacto)
    private readonly contactoModel: typeof OuvContacto,
    @InjectModel(OuvInfluencia)
    private readonly influenciaModel: typeof OuvInfluencia,
    private readonly demandGeneration: DemandGenerationService,
    private readonly accountsService: AccountsService,
    private readonly workflowEngine: WorkflowEngineService,
  ) {}

  /**
   * Reuse lead people as ouv_contactos rows (EARS-02) — no copy of denorm fields.
   * Public API for qualification txn via crearDesdeSql.
   * Prefer passing personIds already resolved from the lead (same txn context).
   */
  async reutilizarDesdeLead(
    ouvId: string,
    leadId: string,
    transaction: Transaction,
    personIdsFromLead?: string[],
  ): Promise<OuvContacto[]> {
    if (!ouvId?.trim()) {
      throw new BadRequestException(
        'ouvId is required to reuse lead contacts into ouv_contactos',
      );
    }

    let personIds = (personIdsFromLead ?? [])
      .map((id) => id?.trim())
      .filter((id): id is string => Boolean(id));

    if (personIds.length === 0) {
      const lead = await this.demandGeneration.findLeadById(leadId);
      personIds = (lead.contacts ?? [])
        .map((contact) => contact.person_id?.trim())
        .filter((id): id is string => Boolean(id));
    }

    const uniquePersonIds = [...new Set(personIds)];
    if (uniquePersonIds.length === 0) {
      throw new BadRequestException(
        `Lead ${leadId} has no contacts with person_id to reuse on OUV (EARS-02)`,
      );
    }

    const created: OuvContacto[] = [];
    for (const personId of uniquePersonIds) {
      const row = await this.contactoModel.create(
        {
          contactoOuvId: randomUUID(),
          ouvId,
          personId,
          notas: null,
        },
        { transaction },
      );
      created.push(row);
    }

    if (created.length === 0) {
      throw new BadRequestException(
        `Failed to create ouv_contactos for OUV ${ouvId} from lead ${leadId} (EARS-02)`,
      );
    }

    return created;
  }

  async listByOuv(ouvId: string): Promise<OuvContactoResponseDto[]> {
    const rows = await this.contactoModel.findAll({
      where: { ouvId },
      order: [['createdAt', 'ASC']],
    });
    return this.toEnrichedResponses(rows);
  }

  async crear(
    ouvId: string,
    dto: CrearOuvContactoDto,
    actorUserId: string,
    roleName: string,
  ): Promise<OuvContactoResponseDto> {
    return this.ouvModel.sequelize!.transaction(async (transaction) => {
      const ouv = await this.lockOwnedOuv(
        ouvId,
        actorUserId,
        roleName,
        transaction,
      );
      const personId = await this.resolvePersonId(dto);

      const people = await this.accountsService.getPeopleWithAccounts([
        personId,
      ]);
      const person = people.get(personId);
      if (!person) {
        throw new NotFoundException(`Person ${personId} not found`);
      }

      await this.applyAccountConstraint(ouv, person.account_id, transaction);

      const contacto = await this.contactoModel.create(
        {
          ouvId,
          personId,
          notas: dto.notas?.trim() || null,
        },
        { transaction },
      );

      await this.workflowEngine.transition(
        EntityType.OUV,
        ouv.ouvId,
        'ouv.contacto_creado',
        {
          estadoAnterior: ouv.zonaActual,
          estadoNuevo: ouv.zonaActual,
          entityLabel: ouv.consecutivo,
          actorUserId,
          payload: {
            comercial_id: ouv.comercialId,
            contacto_ouv_id: contacto.contactoOuvId,
            person_id: personId,
            name: person.name,
          },
          entity: { estado: ouv.zonaActual },
        },
        transaction,
      );

      const [enriched] = await this.toEnrichedResponses([contacto]);
      return enriched;
    });
  }

  async actualizarNotas(
    contactoOuvId: string,
    dto: ActualizarOuvContactoDto,
    actorUserId: string,
    roleName: string,
  ): Promise<OuvContactoResponseDto> {
    return this.ouvModel.sequelize!.transaction(async (transaction) => {
      const contacto = await this.contactoModel.findByPk(contactoOuvId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!contacto) {
        throw new NotFoundException(`Contacto OUV ${contactoOuvId} not found`);
      }

      await this.lockOwnedOuv(
        contacto.ouvId,
        actorUserId,
        roleName,
        transaction,
      );

      await contacto.update(
        {
          ...(dto.notas !== undefined
            ? { notas: dto.notas?.trim() || null }
            : {}),
        },
        { transaction },
      );

      const [enriched] = await this.toEnrichedResponses([contacto]);
      return enriched;
    });
  }

  async eliminar(
    contactoOuvId: string,
    actorUserId: string,
    roleName: string,
  ): Promise<void> {
    return this.ouvModel.sequelize!.transaction(async (transaction) => {
      const contacto = await this.contactoModel.findByPk(contactoOuvId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!contacto) {
        throw new NotFoundException(`Contacto OUV ${contactoOuvId} not found`);
      }

      const ouv = await this.lockOwnedOuv(
        contacto.ouvId,
        actorUserId,
        roleName,
        transaction,
      );

      await this.influenciaModel.update(
        { contactoOuvId: null },
        {
          where: { contactoOuvId: contacto.contactoOuvId },
          transaction,
        },
      );

      await contacto.destroy({ transaction });

      await this.workflowEngine.transition(
        EntityType.OUV,
        ouv.ouvId,
        'ouv.contacto_eliminado',
        {
          estadoAnterior: ouv.zonaActual,
          estadoNuevo: ouv.zonaActual,
          entityLabel: ouv.consecutivo,
          actorUserId,
          payload: {
            comercial_id: ouv.comercialId,
            contacto_ouv_id: contactoOuvId,
            person_id: contacto.personId,
          },
          entity: { estado: ouv.zonaActual },
        },
        transaction,
      );
    });
  }

  private async resolvePersonId(dto: CrearOuvContactoDto): Promise<string> {
    if (dto.person_id) {
      return dto.person_id;
    }
    if (!dto.person) {
      throw new BadRequestException(
        'Provide person_id or person to create an OUV contact',
      );
    }
    const inline = dto.person;
    if (inline.account_id) {
      const created = await this.accountsService.createPerson({
        name: inline.name,
        job_title: inline.job_title ?? null,
        email: inline.email ?? null,
        phone: inline.phone ?? null,
        account_id: inline.account_id,
      });
      return created.person_id;
    }
    if (!inline.account?.name) {
      throw new BadRequestException(
        'Inline person requires account_id or account.name',
      );
    }
    const created = await this.accountsService.findOrCreateAccountAndPerson({
      account_name: inline.account.name,
      tax_id: inline.account.tax_id ?? null,
      person_name: inline.name,
      job_title: inline.job_title ?? null,
      email: inline.email ?? null,
      phone: inline.phone ?? null,
    });
    return created.person_id;
  }

  /** EARS-08b — one account per OUV. */
  private async applyAccountConstraint(
    ouv: Ouv,
    personAccountId: string,
    transaction: Transaction,
  ): Promise<void> {
    if (ouv.accountId) {
      if (ouv.accountId !== personAccountId) {
        throw new BadRequestException(
          'El contacto pertenece a una empresa distinta a la asociada a esta OUV.',
        );
      }
      return;
    }

    const existing = await this.contactoModel.findAll({
      where: { ouvId: ouv.ouvId },
      transaction,
    });

    if (existing.length === 0) {
      const account = await this.accountsService.getAccount(personAccountId);
      await ouv.update(
        {
          accountId: personAccountId,
          empresaNombre: account.name,
        },
        { transaction },
      );
      return;
    }

    const existingPeople = await this.accountsService.getPeopleWithAccounts(
      existing.map((row) => row.personId),
    );
    const existingAccountIds = new Set(
      [...existingPeople.values()].map((p) => p.account_id),
    );
    if (
      existingAccountIds.size > 0 &&
      !existingAccountIds.has(personAccountId)
    ) {
      throw new BadRequestException(
        'El contacto pertenece a una empresa distinta a la asociada a esta OUV.',
      );
    }

    const account = await this.accountsService.getAccount(personAccountId);
    await ouv.update(
      {
        accountId: personAccountId,
        empresaNombre: account.name,
      },
      { transaction },
    );
  }

  private async toEnrichedResponses(
    rows: OuvContacto[],
  ): Promise<OuvContactoResponseDto[]> {
    const personIds = rows.map((r) => r.personId);
    const people = await this.accountsService.getPeopleWithAccounts(personIds);
    return rows.map((r) => {
      const p = people.get(r.personId);
      return {
        contacto_ouv_id: r.contactoOuvId,
        ouv_id: r.ouvId,
        person_id: r.personId,
        name: p?.name ?? '',
        job_title: p?.job_title ?? null,
        email: p?.email ?? null,
        phone: p?.phone ?? null,
        account_id: p?.account_id ?? '',
        account_name: p?.account_name ?? '',
        notas: r.notas,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
      };
    });
  }

  private async lockOwnedOuv(
    ouvId: string,
    actorUserId: string,
    roleName: string,
    transaction: Transaction,
  ): Promise<Ouv> {
    const ouv = await this.ouvModel.findByPk(ouvId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!ouv) {
      throw new NotFoundException(`OUV ${ouvId} not found`);
    }
    if (!canMutateOuvEnCurso(ouv.comercialId, actorUserId, roleName)) {
      throw new ForbiddenException(
        'Only the owning EjecutivoComercial or Admin can manage OUV contacts',
      );
    }
    if (ouv.resultado !== OuvResultado.EnCurso) {
      throw new BadRequestException(
        `Cannot modify contacts on a closed OUV (resultado=${ouv.resultado})`,
      );
    }
    return ouv;
  }
}
