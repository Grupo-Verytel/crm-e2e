import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
import {
  CursorExpiredError,
  CursorInvalidError,
  decodeCursor,
  encodeCursor,
} from '../domain/cursor';
import { ServiceHorizon } from '../domain/enums';
import { MepProblemException } from '../domain/mep-problem.exception';
import { toRfc3339 } from '../domain/rfc3339';
import {
  DEFAULT_INTAKE_LIMIT,
  ListInteractionsQueryDto,
} from '../dtos/list-interactions-query.dto';
import {
  InteractionContract,
  presentInteraction,
} from '../presenters/contract.presenter';
import { CommercialInteraction, InteractionRequestedService } from '../models';

export interface IntakePage {
  items: InteractionContract[];
  has_more: boolean;
  next_cursor: string | null;
  page_observed_at: string | null;
  high_watermark: string | null;
}

/**
 * Pull paginado de intake — §6.1 (T-101, T-102, T-105).
 *
 * INV-03: orden total `source_created_at ASC, id ASC`; el cursor codifica esa
 * clave y va firmado. Se prohíbe `OFFSET`: la página siguiente se resuelve por
 * comparación de la clave, lo que la hace inmune a inserciones concurrentes.
 * INV-05: releer con el mismo cursor devuelve exactamente los mismos ítems —
 * no se filtra por "ya entregado", no hay estado de entrega del lado servidor.
 */
@Injectable()
export class IntakeService {
  constructor(
    @InjectModel(CommercialInteraction)
    private readonly interactionModel: typeof CommercialInteraction,
    private readonly config: ConfigService,
  ) {}

  async listInteractions(query: ListInteractionsQueryDto): Promise<IntakePage> {
    const limit = query.limit ?? DEFAULT_INTAKE_LIMIT;
    const horizon = query.service_horizon ?? null;
    const secret = this.cursorSecret();

    const where = this.buildWhere(horizon, query.cursor, secret);

    // Se pide un elemento extra para decidir `has_more` sin un COUNT aparte.
    const rows = await this.interactionModel.findAll({
      where,
      include: [InteractionRequestedService],
      order: [
        ['source_created_at', 'ASC'],
        ['id', 'ASC'],
      ],
      limit: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    return {
      items: page.map((row) => presentInteraction(row)),
      has_more: hasMore,
      // INV-04: `has_more = false` ⇔ `next_cursor = null`.
      next_cursor:
        hasMore && last
          ? encodeCursor(
              {
                t: new Date(last.sourceCreatedAt).getTime(),
                i: String(last.id),
                h: horizon,
              },
              secret,
            )
          : null,
      page_observed_at: toRfc3339(new Date()),
      // Mayor `source_created_at` de la página; `null` si va vacía.
      high_watermark: last ? toRfc3339(last.sourceCreatedAt) : null,
    };
  }

  /** §6.2 — relectura por identidad. */
  async findByRef(
    interactionRef: string,
  ): Promise<CommercialInteraction | null> {
    return this.interactionModel.findOne({
      where: { crmInteractionRef: interactionRef },
      include: [InteractionRequestedService],
    });
  }

  private buildWhere(
    horizon: ServiceHorizon | null,
    cursor: string | undefined,
    secret: string,
  ): WhereOptions {
    const clauses: WhereOptions[] = [
      // OPEN-10: criterio de elegibilidad; hoy es la bandera explícita del CRM.
      { eligibleForMep: true },
    ];

    if (horizon !== null) {
      clauses.push({ serviceHorizon: horizon });
    }

    if (cursor) {
      const payload = this.decode(cursor, secret);

      // Un cursor emitido con otro filtro no puede reutilizarse: rompería la
      // estabilidad exigida por INV-05.
      if ((payload.h ?? null) !== horizon) {
        throw MepProblemException.badRequest(
          'INVALID_CURSOR',
          'El cursor fue emitido con un filtro `service_horizon` distinto.',
        );
      }

      const boundary = new Date(payload.t);

      // Cursor **exclusivo**: la página siguiente no repite el último elemento.
      clauses.push({
        [Op.or]: [
          { sourceCreatedAt: { [Op.gt]: boundary } },
          {
            [Op.and]: [
              { sourceCreatedAt: boundary },
              { id: { [Op.gt]: payload.i } },
            ],
          },
        ],
      });
    }

    return { [Op.and]: clauses };
  }

  private decode(cursor: string, secret: string) {
    try {
      return decodeCursor(cursor, secret);
    } catch (error) {
      if (error instanceof CursorExpiredError) {
        throw MepProblemException.badRequest(
          'CURSOR_EXPIRED',
          'El cursor superó la retención declarada de 7 días.',
        );
      }
      if (error instanceof CursorInvalidError) {
        throw MepProblemException.badRequest(
          'INVALID_CURSOR',
          'El cursor es inválido o su firma no verifica.',
        );
      }
      throw error;
    }
  }

  private cursorSecret(): string {
    return this.config.getOrThrow<string>('MEP_CURSOR_SECRET');
  }
}
