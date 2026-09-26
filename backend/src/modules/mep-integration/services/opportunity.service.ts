import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../../auth/models/user.model';
import { Ouv } from '../../discovery/models/ouv.model';
import { CommercialOpportunity } from '../models';
import {
  applyOuvFieldsToCommercialOpportunity,
  ouvToOpportunityProjection,
} from '../domain/apply-ouv-to-commercial-opportunity';

/**
 * Contexto puntual de OUV — §6.3 (T-104).
 *
 * INV-11: solo lectura. No existe ninguna operación en este módulo que escriba
 * `commercial_archetype` ni ningún otro campo de la OUV: el arquetipo comercial
 * es autoridad exclusiva del CRM y MEP no lo devuelve ni lo sobrescribe por
 * este contrato (TS-OUV-04 verifica que el verbo de escritura no existe).
 *
 * `status` y `expected_close_date` se proyectan en tiempo de lectura desde
 * `ouvs.resultado` y `ouvs.created_at` + `ouvs.plazo_ejecucion_meses`.
 */
@Injectable()
export class OpportunityService {
  constructor(
    @InjectModel(CommercialOpportunity)
    private readonly opportunityModel: typeof CommercialOpportunity,
    @InjectModel(Ouv)
    private readonly ouvModel: typeof Ouv,
  ) {}

  async findByRef(
    opportunityRef: string,
  ): Promise<CommercialOpportunity | null> {
    const opportunity = await this.opportunityModel.findOne({
      where: { crmOpportunityRef: opportunityRef },
    });

    if (!opportunity) {
      return null;
    }

    const ouv = await this.ouvModel.findOne({
      where: { consecutivo: opportunityRef },
      include: [
        {
          model: User,
          as: 'comercial',
          attributes: ['fullName'],
        },
      ],
    });

    if (ouv) {
      applyOuvFieldsToCommercialOpportunity(
        opportunity,
        ouvToOpportunityProjection(ouv),
      );
    }

    return opportunity;
  }
}
