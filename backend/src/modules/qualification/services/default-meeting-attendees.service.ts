import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UniqueConstraintError } from 'sequelize';
import { QUALIFICATION_ERROR_CODES } from '../constants/qualification.constants';
import {
  CreateDefaultMeetingAttendeeDto,
  DefaultMeetingAttendeeListResponseDto,
  DefaultMeetingAttendeeResponseDto,
  DeleteDefaultMeetingAttendeeResponseDto,
  UpdateDefaultMeetingAttendeeDto,
} from '../dtos/default-meeting-attendee.dto';
import { DefaultMeetingAttendee } from '../models/default-meeting-attendee.model';

const EMAIL_CONFLICT = 'Ese correo ya está en la lista.';
const NOT_FOUND = 'No se encontró el invitado.';
const EMPTY_PATCH = 'No hay cambios para guardar.';

@Injectable()
export class DefaultMeetingAttendeesService {
  constructor(
    @InjectModel(DefaultMeetingAttendee)
    private readonly attendeeModel: typeof DefaultMeetingAttendee,
  ) {}

  async list(): Promise<DefaultMeetingAttendeeListResponseDto> {
    const rows = await this.attendeeModel.findAll({
      order: [
        ['sortOrder', 'ASC'],
        ['email', 'ASC'],
      ],
    });
    return { items: rows.map((row) => this.toResponse(row)) };
  }

  async create(
    dto: CreateDefaultMeetingAttendeeDto,
  ): Promise<DefaultMeetingAttendeeResponseDto> {
    const email = this.normalizeEmail(dto.email);
    await this.assertEmailAvailable(email);
    const sortOrder = (await this.nextSortOrder());
    try {
      const created = await this.attendeeModel.create({
        email,
        name: this.normalizeName(dto.name),
        sortOrder,
        isActive: true,
      });
      return this.toResponse(created);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        this.throwConflict();
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateDefaultMeetingAttendeeDto,
  ): Promise<DefaultMeetingAttendeeResponseDto> {
    if (dto.name === undefined && dto.is_active === undefined) {
      throw new BadRequestException({
        code: QUALIFICATION_ERROR_CODES.VALIDATION_ERROR,
        message: EMPTY_PATCH,
      });
    }

    const row = await this.findLiveOrFail(id);
    const patch: { name?: string | null; isActive?: boolean } = {};
    if (dto.name !== undefined) {
      patch.name = this.normalizeName(dto.name);
    }
    if (dto.is_active !== undefined) {
      patch.isActive = dto.is_active;
    }
    await row.update(patch);
    return this.toResponse(row);
  }

  async remove(id: string): Promise<DeleteDefaultMeetingAttendeeResponseDto> {
    const row = await this.findLiveOrFail(id);
    await row.destroy();
    return { deleted: true };
  }

  private async assertEmailAvailable(email: string): Promise<void> {
    const existing = await this.attendeeModel.findOne({ where: { email } });
    if (existing) {
      this.throwConflict();
    }
  }

  private async nextSortOrder(): Promise<number> {
    const max = await this.attendeeModel.max('sortOrder');
    const current = typeof max === 'number' ? max : Number(max);
    if (!Number.isFinite(current)) {
      return 1;
    }
    return current + 1;
  }

  private async findLiveOrFail(id: string): Promise<DefaultMeetingAttendee> {
    const row = await this.attendeeModel.findByPk(id);
    if (!row) {
      throw new NotFoundException({
        code: QUALIFICATION_ERROR_CODES.NOT_FOUND,
        message: NOT_FOUND,
      });
    }
    return row;
  }

  private throwConflict(): never {
    throw new ConflictException({
      code: 'CONFLICT',
      message: EMAIL_CONFLICT,
    });
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeName(name: string | null | undefined): string | null {
    if (name == null) {
      return null;
    }
    const trimmed = name.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private toResponse(
    row: DefaultMeetingAttendee,
  ): DefaultMeetingAttendeeResponseDto {
    return {
      default_meeting_attendee_id: row.defaultMeetingAttendeeId,
      email: row.email,
      name: row.name,
      sort_order: row.sortOrder,
      is_active: row.isActive,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }
}
