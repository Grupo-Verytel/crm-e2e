import { Op, Sequelize, WhereOptions } from 'sequelize';
import { Lead } from '../models/lead.model';

/**
 * Partial-match filter for lead lists: name, NIT, city, industry,
 * linked account/person, or campaign name.
 */
export function leadTextSearchWhere(
  sequelize: Sequelize,
  q?: string,
): WhereOptions<Lead> | undefined {
  const term = q?.trim();
  if (!term) {
    return undefined;
  }

  const like = `%${term}%`;
  const escaped = sequelize.escape(like);

  return {
    [Op.or]: [
      { name: { [Op.like]: like } },
      { nit: { [Op.like]: like } },
      { ciudad: { [Op.like]: like } },
      { industria: { [Op.like]: like } },
      {
        leadId: {
          [Op.in]: Sequelize.literal(`(
            SELECT lc.lead_id
            FROM lead_contacts AS lc
            INNER JOIN people AS p
              ON p.person_id = lc.person_id AND p.deleted_at IS NULL
            LEFT JOIN accounts AS a
              ON a.account_id = p.account_id AND a.deleted_at IS NULL
            WHERE lc.deleted_at IS NULL
              AND (
                p.name LIKE ${escaped}
                OR IFNULL(p.email, '') LIKE ${escaped}
                OR IFNULL(p.phone, '') LIKE ${escaped}
                OR IFNULL(a.name, '') LIKE ${escaped}
                OR IFNULL(a.tax_id, '') LIKE ${escaped}
              )
          )`),
        },
      },
      {
        campanaId: {
          [Op.in]: Sequelize.literal(`(
            SELECT c.campana_id
            FROM campaigns AS c
            WHERE c.deleted_at IS NULL
              AND c.nombre LIKE ${escaped}
          )`),
        },
      },
    ],
  };
}
