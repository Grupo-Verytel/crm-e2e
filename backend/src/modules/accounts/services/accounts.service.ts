import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import {
  col,
  fn,
  Op,
  QueryTypes,
  Sequelize,
  where as sqlWhere,
  WhereOptions,
} from 'sequelize';
import { ACCOUNTS_ERROR_CODES } from '../constants/accounts.constants';
import {
  AccountResponseDto,
  AccountsQueryDto,
  CreateAccountDto,
  CreatePersonDto,
  PaginatedAccountsResponseDto,
  PaginatedPeopleResponseDto,
  PeopleQueryDto,
  PersonResponseDto,
  UpdateAccountDto,
  UpdatePersonDto,
} from '../dtos/accounts.dto';
import { Account } from '../models/account.model';
import { Person } from '../models/person.model';

@Injectable()
export class AccountsService {
  constructor(
    @InjectModel(Account) private readonly accountModel: typeof Account,
    @InjectModel(Person) private readonly personModel: typeof Person,
    @InjectConnection() private readonly sequelize: Sequelize,
  ) {}

  async listAccounts(
    query: AccountsQueryDto,
  ): Promise<PaginatedAccountsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const where: WhereOptions<Account> = {};

    if (query.q?.trim()) {
      const q = `%${query.q.trim()}%`;
      Object.assign(where, {
        [Op.or]: [
          { name: { [Op.like]: q } },
          { taxId: { [Op.like]: q } },
        ],
      });
    }

    const { rows, count } = await this.accountModel.findAndCountAll({
      where,
      order: [['name', 'ASC']],
      limit,
      offset,
    });

    return {
      items: rows.map((row) => this.toAccountDto(row)),
      total: count,
      page,
      limit,
    };
  }

  async getAccount(accountId: string): Promise<AccountResponseDto> {
    const account = await this.findAccountOrFail(accountId);
    return this.toAccountDto(account);
  }

  async createAccount(dto: CreateAccountDto): Promise<AccountResponseDto> {
    const name = dto.name.trim();
    const taxId = this.normalizeOptional(dto.tax_id);
    await this.assertAccountUniqueness(name, taxId);

    const account = await this.accountModel.create({
      name,
      taxId,
      economicSector: this.normalizeOptional(dto.economic_sector),
      address: this.normalizeOptional(dto.address),
      website: this.normalizeOptional(dto.website),
    });
    return this.toAccountDto(account);
  }

  async updateAccount(
    accountId: string,
    dto: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    const account = await this.findAccountOrFail(accountId);
    const name = dto.name !== undefined ? dto.name.trim() : account.name;
    const taxId =
      dto.tax_id !== undefined
        ? this.normalizeOptional(dto.tax_id)
        : account.taxId;

    await this.assertAccountUniqueness(name, taxId, accountId);
    await account.update({
      name,
      taxId,
      ...(dto.economic_sector !== undefined
        ? { economicSector: this.normalizeOptional(dto.economic_sector) }
        : {}),
      ...(dto.address !== undefined
        ? { address: this.normalizeOptional(dto.address) }
        : {}),
      ...(dto.website !== undefined
        ? { website: this.normalizeOptional(dto.website) }
        : {}),
    });
    return this.toAccountDto(account);
  }

  async deleteAccount(accountId: string): Promise<void> {
    const account = await this.findAccountOrFail(accountId);
    const peopleCount = await this.personModel.count({
      where: { accountId },
    });
    if (peopleCount > 0) {
      throw new ConflictException({
        code: ACCOUNTS_ERROR_CODES.ACCOUNT_HAS_PEOPLE,
        message:
          'No se puede eliminar la empresa: tiene contactos activos asociados.',
      });
    }
    await account.destroy();
  }

  async listPeople(query: PeopleQueryDto): Promise<PaginatedPeopleResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const where: WhereOptions<Person> = {};

    if (query.account_id) {
      where.accountId = query.account_id;
    }

    if (query.q?.trim()) {
      const q = `%${query.q.trim()}%`;
      Object.assign(where, {
        [Op.or]: [
          { name: { [Op.like]: q } },
          { email: { [Op.like]: q } },
          { phone: { [Op.like]: q } },
        ],
      });
    }

    const { rows, count } = await this.personModel.findAndCountAll({
      where,
      include: [{ model: Account, as: 'account', required: false }],
      order: [['name', 'ASC']],
      limit,
      offset,
    });

    return {
      items: rows.map((row) => this.toPersonDto(row)),
      total: count,
      page,
      limit,
    };
  }

  async getPerson(personId: string): Promise<PersonResponseDto> {
    const person = await this.findPersonOrFail(personId);
    return this.toPersonDto(person);
  }

  /**
   * Public API for demand-generation: load people + accounts by ids.
   * Returns Map keyed by person_id.
   */
  async getPeopleWithAccounts(
    personIds: string[],
  ): Promise<
    Map<
      string,
      {
        person_id: string;
        name: string;
        job_title: string | null;
        email: string | null;
        phone: string | null;
        account_id: string;
        account_name: string;
        account_tax_id: string | null;
      }
    >
  > {
    const unique = [...new Set(personIds.filter(Boolean))];
    const map = new Map<
      string,
      {
        person_id: string;
        name: string;
        job_title: string | null;
        email: string | null;
        phone: string | null;
        account_id: string;
        account_name: string;
        account_tax_id: string | null;
      }
    >();
    if (unique.length === 0) {
      return map;
    }

    const rows = await this.personModel.findAll({
      where: { personId: { [Op.in]: unique } },
      include: [{ model: Account, as: 'account', required: true }],
    });

    for (const person of rows) {
      map.set(person.personId, {
        person_id: person.personId,
        name: person.name,
        job_title: person.jobTitle,
        email: person.email,
        phone: person.phone,
        account_id: person.accountId,
        account_name: person.account.name,
        account_tax_id: person.account.taxId,
      });
    }
    return map;
  }

  /** Assert all person ids exist, have account_id, and share the same account. */
  async assertPeopleSameAccount(personIds: string[]): Promise<string> {
    const people = await this.getPeopleWithAccounts(personIds);
    if (people.size !== new Set(personIds).size) {
      throw new NotFoundException({
        code: ACCOUNTS_ERROR_CODES.PERSON_NOT_FOUND,
        message: 'One or more contacts (people) were not found.',
      });
    }
    const accountIds = new Set(
      [...people.values()].map((p) => p.account_id),
    );
    if (accountIds.size !== 1) {
      throw new ConflictException({
        code: ACCOUNTS_ERROR_CODES.ACCOUNT_CONFLICT,
        message:
          'Todos los contactos del lead deben pertenecer a la misma empresa.',
      });
    }
    return [...accountIds][0];
  }

  async findOrCreateAccountAndPerson(input: {
    account_name: string;
    tax_id?: string | null;
    person_name: string;
    job_title?: string | null;
    email?: string | null;
    phone?: string | null;
  }): Promise<{ person_id: string; account_id: string }> {
    const taxId = this.normalizeOptional(input.tax_id);
    const email = this.normalizeOptional(input.email)?.toLowerCase() ?? null;
    let account = taxId
      ? await this.accountModel.findOne({ where: { taxId } })
      : null;
    if (!account) {
      account = await this.accountModel.findOne({
        where: sqlWhere(
          fn('LOWER', col('name')),
          input.account_name.trim().toLowerCase(),
        ),
      });
    }
    if (!account) {
      const created = await this.createAccount({
        name: input.account_name,
        tax_id: taxId,
      });
      account = await this.findAccountOrFail(created.account_id);
    }

    let person =
      email != null
        ? await this.personModel.findOne({
            where: { email, accountId: account.accountId },
          })
        : null;
    if (!person) {
      const created = await this.createPerson({
        name: input.person_name,
        job_title: input.job_title ?? null,
        email,
        phone: input.phone ?? null,
        account_id: account.accountId,
      });
      return { person_id: created.person_id, account_id: account.accountId };
    }
    return { person_id: person.personId, account_id: account.accountId };
  }

  async createPerson(dto: CreatePersonDto): Promise<PersonResponseDto> {
    if (!dto.account_id) {
      throw new ConflictException({
        code: ACCOUNTS_ERROR_CODES.ACCOUNT_ID_REQUIRED,
        message: 'El contacto debe estar asociado a una empresa.',
      });
    }
    await this.findAccountOrFail(dto.account_id);

    const email = this.normalizeOptional(dto.email);
    await this.assertPersonEmailUniqueness(email);

    const person = await this.personModel.create({
      name: dto.name.trim(),
      jobTitle: this.normalizeOptional(dto.job_title),
      email,
      phone: this.normalizeOptional(dto.phone),
      accountId: dto.account_id,
    });

    await person.reload({
      include: [{ model: Account, as: 'account', required: false }],
    });
    return this.toPersonDto(person);
  }

  async updatePerson(
    personId: string,
    dto: UpdatePersonDto,
  ): Promise<PersonResponseDto> {
    const person = await this.findPersonOrFail(personId);

    if (dto.email !== undefined) {
      const email = this.normalizeOptional(dto.email);
      await this.assertPersonEmailUniqueness(email, personId);
      person.email = email;
    }
    if (dto.name !== undefined) {
      person.name = dto.name.trim();
    }
    if (dto.job_title !== undefined) {
      person.jobTitle = this.normalizeOptional(dto.job_title);
    }
    if (dto.phone !== undefined) {
      person.phone = this.normalizeOptional(dto.phone);
    }

    await person.save();
    await person.reload({
      include: [{ model: Account, as: 'account', required: false }],
    });
    return this.toPersonDto(person);
  }

  async deletePerson(personId: string): Promise<void> {
    const person = await this.findPersonOrFail(personId);
    if (await this.personIsReferenced(personId)) {
      throw new ConflictException({
        code: ACCOUNTS_ERROR_CODES.PERSON_REFERENCED,
        message:
          'No se puede eliminar el contacto: está asociado a un lead u OUV.',
      });
    }
    await person.destroy();
  }

  private async assertAccountUniqueness(
    name: string,
    taxId: string | null,
    excludeId?: string,
  ): Promise<void> {
    if (taxId) {
      const byTax = await this.accountModel.findOne({
        where: {
          taxId,
          ...(excludeId ? { accountId: { [Op.ne]: excludeId } } : {}),
        },
      });
      if (byTax) {
        throw new ConflictException({
          code: ACCOUNTS_ERROR_CODES.ACCOUNT_TAX_ID_CONFLICT,
          message: 'Ya existe una empresa con ese NIT / tax_id.',
        });
      }
    }

    const nameTaxWhere: WhereOptions[] = [
      sqlWhere(fn('LOWER', col('name')), name.toLowerCase()),
      taxId === null ? { taxId: { [Op.is]: null } } : { taxId },
    ];
    if (excludeId) {
      nameTaxWhere.push({ accountId: { [Op.ne]: excludeId } });
    }

    const byNameTax = await this.accountModel.findOne({
      where: { [Op.and]: nameTaxWhere },
    });
    if (byNameTax) {
      throw new ConflictException({
        code: ACCOUNTS_ERROR_CODES.ACCOUNT_NAME_TAX_CONFLICT,
        message:
          'Ya existe una empresa con la misma combinación de nombre y NIT.',
      });
    }
  }

  private async assertPersonEmailUniqueness(
    email: string | null,
    excludeId?: string,
  ): Promise<void> {
    if (!email) {
      return;
    }
    const existing = await this.personModel.findOne({
      where: {
        email,
        ...(excludeId ? { personId: { [Op.ne]: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictException({
        code: ACCOUNTS_ERROR_CODES.PERSON_EMAIL_CONFLICT,
        message: 'Ya existe un contacto con ese email.',
      });
    }
  }

  /**
   * GC-11: block soft-delete when active lead_contacts / ouv_contactos
   * reference person_id. Both bridges have person_id (demand-gen v2.5 + OUV Funnel v1.4).
   */
  private async personIsReferenced(personId: string): Promise<boolean> {
    for (const table of ['lead_contacts', 'ouv_contactos'] as const) {
      const refs = await this.sequelize.query<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM \`${table}\` WHERE person_id = :personId AND deleted_at IS NULL`,
        {
          replacements: { personId },
          type: QueryTypes.SELECT,
        },
      );
      if (Number(refs[0]?.cnt ?? 0) > 0) {
        return true;
      }
    }
    return false;
  }

  private async findAccountOrFail(accountId: string): Promise<Account> {
    const account = await this.accountModel.findByPk(accountId);
    if (!account) {
      throw new NotFoundException({
        code: ACCOUNTS_ERROR_CODES.ACCOUNT_NOT_FOUND,
        message: 'Empresa no encontrada.',
      });
    }
    return account;
  }

  private async findPersonOrFail(personId: string): Promise<Person> {
    const person = await this.personModel.findByPk(personId, {
      include: [{ model: Account, as: 'account', required: false }],
    });
    if (!person) {
      throw new NotFoundException({
        code: ACCOUNTS_ERROR_CODES.PERSON_NOT_FOUND,
        message: 'Contacto no encontrado.',
      });
    }
    return person;
  }

  private normalizeOptional(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  private toAccountDto(account: Account): AccountResponseDto {
    return {
      account_id: account.accountId,
      name: account.name,
      tax_id: account.taxId,
      economic_sector: account.economicSector,
      address: account.address,
      website: account.website,
      created_at: account.createdAt,
      updated_at: account.updatedAt,
    };
  }

  private toPersonDto(person: Person): PersonResponseDto {
    return {
      person_id: person.personId,
      name: person.name,
      job_title: person.jobTitle,
      email: person.email,
      phone: person.phone,
      account_id: person.accountId,
      account_name: person.account?.name ?? null,
      created_at: person.createdAt,
      updated_at: person.updatedAt,
    };
  }
}
