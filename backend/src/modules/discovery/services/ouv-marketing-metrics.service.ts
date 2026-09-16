import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { OuvOrigenVia } from '../models/enums/ouv.enums';
import { Ouv } from '../models/ouv.model';

@Injectable()
export class OuvMarketingMetricsService {
  constructor(@InjectModel(Ouv) private readonly ouvModel: typeof Ouv) {}

  async countConvertedFromMarketing(from: Date, to: Date): Promise<number> {
    return this.ouvModel.count({
      where: {
        origenVia: OuvOrigenVia.DesdeSql,
        createdAt: { [Op.gte]: from, [Op.lt]: to },
      },
    });
  }

  async listConvertedFromMarketing(
    from: Date,
    to: Date,
    page = 1,
    limit = 20,
  ): Promise<{ items: Ouv[]; total: number; page: number; limit: number }> {
    const { rows, count } = await this.ouvModel.findAndCountAll({
      where: {
        origenVia: OuvOrigenVia.DesdeSql,
        createdAt: { [Op.gte]: from, [Op.lt]: to },
      },
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    return { items: rows, total: count, page, limit };
  }
}
