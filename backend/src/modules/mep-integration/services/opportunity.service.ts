import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CommercialOpportunity } from '../models';

/**
 * Contexto puntual de OUV — §6.3 (T-104).
 *
 * INV-11: solo lectura. No existe ninguna operación en este módulo que escriba
 * `commercial_archetype` ni ningún otro campo de la OUV: el arquetipo comercial
 * es autoridad exclusiva del CRM y MEP no lo devuelve ni lo sobrescribe por
 * este contrato (TS-OUV-04 verifica que el verbo de escritura no existe).
 */
@Injectable()
export class OpportunityService {
  constructor(
    @InjectModel(CommercialOpportunity)
    private readonly opportunityModel: typeof CommercialOpportunity,
  ) {}

  async findByRef(
    opportunityRef: string,
  ): Promise<CommercialOpportunity | null> {
    return this.opportunityModel.findOne({
      where: { crmOpportunityRef: opportunityRef },
    });
  }
}
