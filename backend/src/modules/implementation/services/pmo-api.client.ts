import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PmoCreateProjectPayload } from '../dtos/create-pmo-project.dto';
import {
  ProjectExecutionDto,
  ProjectStateHistoryDto,
} from '../dtos/project-execution.dto';

const TIMEOUT_MS = 8000;

/**
 * Client for the PMO (Control Project) integration endpoints. Reads are keyed by
 * OUV_ID; the write carries it in the body. All three use the shared API key.
 */
@Injectable()
export class PmoApiClient {
  private readonly logger = new Logger(PmoApiClient.name);

  constructor(private readonly configService: ConfigService) {}

  getExecution(ouvId: string): Promise<ProjectExecutionDto> {
    return this.get<ProjectExecutionDto>('/api/projects/execution', ouvId);
  }

  getStateHistory(ouvId: string): Promise<ProjectStateHistoryDto> {
    return this.get<ProjectStateHistoryDto>(
      '/api/projects/state-history',
      ouvId,
    );
  }

  /**
   * Opens the delivery project in the PMO. The PMO keys on `OUV_ID`, so a repeat
   * of the same OUV comes back as 409 instead of creating a second project.
   */
  async createProject(
    payload: PmoCreateProjectPayload,
  ): Promise<{ PRO_NCODE: number }> {
    const { baseUrl, apiKey } = this.requireConfig();
    const url = new URL('/api/projects', baseUrl);

    const response = await this.fetchOrFail(url, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.status === 409) {
      throw new ConflictException({
        code: 'PMO_PROJECT_ALREADY_EXISTS',
        message: `The PMO already has a project for OUV ${payload.OUV_ID}`,
      });
    }

    if (response.status === 400) {
      // The PMO rejected our payload — a CRM-side defect, not a PMO outage.
      this.logger.error(
        `PMO rejected the project payload: ${await response.text()}`,
      );
      throw new UnprocessableEntityException({
        code: 'PMO_PAYLOAD_REJECTED',
        message: 'The PMO rejected the project data',
      });
    }

    if (!response.ok) {
      throw this.badResponse('/api/projects', response.status);
    }

    return (await response.json()) as { PRO_NCODE: number };
  }

  private async get<T>(path: string, ouvId: string): Promise<T> {
    const { baseUrl, apiKey } = this.requireConfig();

    const url = new URL(path, baseUrl);
    url.searchParams.set('ouvId', ouvId);

    const response = await this.fetchOrFail(url, {
      headers: { 'x-api-key': apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.status === 404) {
      throw new NotFoundException({
        code: 'PMO_PROJECT_NOT_FOUND',
        message: `The PMO has no project linked to OUV ${ouvId}`,
      });
    }

    if (!response.ok) {
      throw this.badResponse(path, response.status);
    }

    return (await response.json()) as T;
  }

  private requireConfig(): { baseUrl: string; apiKey: string } {
    const baseUrl = this.configService.get<string>('PMO_API_BASE_URL');
    const apiKey = this.configService.get<string>('PMO_API_KEY');

    if (!baseUrl || !apiKey) {
      throw new ServiceUnavailableException({
        code: 'PMO_NOT_CONFIGURED',
        message: 'PMO integration is not configured',
      });
    }

    return { baseUrl, apiKey };
  }

  private badResponse(path: string, status: number): BadGatewayException {
    this.logger.error(`PMO ${path} responded ${status}`);
    return new BadGatewayException({
      code: 'PMO_BAD_RESPONSE',
      message: 'The PMO rejected the request',
      details: { status },
    });
  }

  private async fetchOrFail(url: URL, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`PMO unreachable: ${message}`);
      throw new ServiceUnavailableException({
        code: 'PMO_UNREACHABLE',
        message: 'The PMO service is unreachable',
      });
    }
  }
}
