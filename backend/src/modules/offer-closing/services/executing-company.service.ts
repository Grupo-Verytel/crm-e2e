import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, type Transaction } from 'sequelize';
import {
  CreateExecutingCompanyDto,
  ExecutingCompanyListDto,
  ExecutingCompanyResponseDto,
} from '../dtos/executing-company.dto';
import { formatNit, parseNit } from '../lib/nit';
import { JointVenture, Partner } from '../models';

/** Las dos empresas externas que puede tener un expediente. */
export type ExecutingCompanyKind = 'UT' | 'Aliado';

type CatalogRow = JointVenture | Partner;

const ETIQUETA: Record<ExecutingCompanyKind, string> = {
  UT: 'una unión temporal',
  Aliado: 'un aliado',
};

/**
 * Catálogos de uniones temporales y aliados (DR 2026-10 UT y aliados).
 *
 * Misma forma y mismas reglas para los dos: NIT con DV válido y único por
 * catálogo. No hay edición ni borrado desde la UI todavía.
 */
@Injectable()
export class ExecutingCompanyService {
  constructor(
    @InjectModel(JointVenture)
    private readonly jointVentureModel: typeof JointVenture,
    @InjectModel(Partner) private readonly partnerModel: typeof Partner,
  ) {}

  async list(kind: ExecutingCompanyKind): Promise<ExecutingCompanyListDto> {
    const rows: CatalogRow[] = await this.model(kind).findAll({
      where: { active: true },
      order: [['name', 'ASC']],
    });
    return { items: rows.map((row) => this.toResponse(kind, row)) };
  }

  async create(
    kind: ExecutingCompanyKind,
    dto: CreateExecutingCompanyDto,
    userId: string,
  ): Promise<ExecutingCompanyResponseDto> {
    const nit = parseNit(dto.nit);
    if (!nit) {
      throw new BadRequestException({
        code: 'INVALID_NIT',
        message:
          'NIT inválido: escríbelo como base-DV (ej. 900123456-7) y revisa el dígito de verificación',
      });
    }

    // `paranoid: false`: el índice único cubre también las filas borradas.
    const existing: CatalogRow | null = await this.model(kind).findOne({
      where: { taxId: nit.base },
      paranoid: false,
    });
    if (existing && !existing.deletedAt) {
      throw new ConflictException({
        code: 'NIT_ALREADY_EXISTS',
        message: `Ya existe ${ETIQUETA[kind]} con el NIT ${formatNit(nit.base, nit.dv)}: ${existing.name}`,
      });
    }

    const values = {
      taxId: nit.base,
      verificationDigit: nit.dv,
      name: dto.nombre,
      active: true,
      createdBy: userId,
    };

    if (existing) {
      await existing.restore();
      await existing.update(values);
      return this.toResponse(kind, existing);
    }

    const created: CatalogRow = await this.model(kind).create(values);
    return this.toResponse(kind, created);
  }

  /**
   * Nombre vigente de cada id pedido; los que no existen o están inactivos no
   * vienen en el mapa. Lo usa el expediente para validar sus filas.
   */
  async namesById(
    kind: ExecutingCompanyKind,
    ids: string[],
    transaction?: Transaction,
  ): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows: CatalogRow[] = await this.model(kind).findAll({
      where: { [this.pk(kind)]: { [Op.in]: ids }, active: true },
      transaction,
    });
    return new Map(rows.map((row) => [this.idOf(kind, row), row.name]));
  }

  /** Sequelize no unifica los estáticos de dos modelos; se tipa a mano. */
  private model(kind: ExecutingCompanyKind): typeof JointVenture {
    return (
      kind === 'UT' ? this.jointVentureModel : this.partnerModel
    ) as typeof JointVenture;
  }

  private pk(kind: ExecutingCompanyKind): 'jointVentureId' | 'partnerId' {
    return kind === 'UT' ? 'jointVentureId' : 'partnerId';
  }

  private idOf(kind: ExecutingCompanyKind, row: CatalogRow): string {
    return kind === 'UT'
      ? (row as JointVenture).jointVentureId
      : (row as Partner).partnerId;
  }

  private toResponse(
    kind: ExecutingCompanyKind,
    row: CatalogRow,
  ): ExecutingCompanyResponseDto {
    return {
      id: this.idOf(kind, row),
      nit: formatNit(row.taxId, row.verificationDigit),
      nombre: row.name,
      active: row.active,
    };
  }
}
