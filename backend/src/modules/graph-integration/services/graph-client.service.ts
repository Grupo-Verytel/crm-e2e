import {
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GRAPH_BASE_URL,
  GRAPH_LOGIN_BASE_URL,
  GRAPH_SCOPE,
} from '../constants/graph.constants';

type GraphErrorBody = {
  error?: { code?: string; message?: string };
};

type RequestOptions = {
  params?: Record<string, string | number | boolean | undefined>;
  data?: unknown;
  headers?: Record<string, string>;
};

const REQUIRED_ENV = [
  'AZURE_TENANT_ID',
  'AZURE_CLIENT_ID',
  'AZURE_CLIENT_SECRET',
] as const;

/**
 * Cliente app-only (client credentials) de Microsoft Graph.
 *
 * Equivale al bloque MSAL + `graphRequest` del toolkit `MicrosoftGraph`,
 * pero sin dependencias extra: el token se pide con `fetch` al endpoint
 * `/oauth2/v2.0/token` y se cachea hasta un minuto antes de expirar.
 */
@Injectable()
export class GraphClientService {
  private readonly logger = new Logger(GraphClientService.name);

  private cachedToken: string | null = null;
  private cachedExpiry = 0;
  private pendingToken: Promise<string> | null = null;

  constructor(private readonly configService: ConfigService) {}

  /** Variables de entorno que faltan para poder hablar con Graph. */
  get missingEnv(): string[] {
    return REQUIRED_ENV.filter(
      (key) => !this.configService.get<string>(key)?.trim(),
    );
  }

  get isConfigured(): boolean {
    return this.missingEnv.length === 0;
  }

  /** Roles (permisos de aplicación) concedidos al app registration. */
  async getRoles(): Promise<string[]> {
    const token = await this.getToken();
    const payload = decodeJwtPayload(token);
    return Array.isArray(payload.roles) ? (payload.roles as string[]) : [];
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const token = await this.getToken();
    const url = path.startsWith('http')
      ? new URL(path)
      : new URL(`${GRAPH_BASE_URL}${path}`);

    for (const [key, value] of Object.entries(options.params ?? {})) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...options.headers,
    };
    if (options.data !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body:
          options.data !== undefined ? JSON.stringify(options.data) : undefined,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new ServiceUnavailableException(
        `No se pudo contactar Microsoft Graph: ${detail}`,
      );
    }

    if (!response.ok) {
      const body = (await safeJson(response)) as GraphErrorBody | null;
      const graphError = body?.error;
      this.logger.error(
        `Graph ${method} ${url.pathname} → ${response.status} ${
          graphError?.code ?? ''
        } ${graphError?.message ?? ''}`.trim(),
      );
      throw new HttpException(
        {
          message:
            graphError?.message ??
            `Microsoft Graph respondió ${response.status}`,
          code: graphError?.code ?? 'GRAPH_ERROR',
        },
        response.status,
      );
    }

    // Varias acciones (`/cancel`, `DELETE`) responden 202/204 con cuerpo
    // vacío: `response.json()` sobre eso lanza «Unexpected end of JSON input».
    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  }

  /** Recorre `@odata.nextLink` hasta agotar la colección. */
  async requestAll<T>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T[]> {
    const items: T[] = [];
    let next: string | null = null;

    do {
      const page: { value?: T[]; '@odata.nextLink'?: string } = next
        ? await this.request('GET', next, { headers: options.headers })
        : await this.request('GET', path, options);
      items.push(...(page.value ?? []));
      next = page['@odata.nextLink'] ?? null;
    } while (next);

    return items;
  }

  private async getToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.cachedExpiry - 60_000) {
      return this.cachedToken;
    }
    if (this.pendingToken) {
      return this.pendingToken;
    }

    this.pendingToken = this.acquireToken().finally(() => {
      this.pendingToken = null;
    });
    return this.pendingToken;
  }

  private async acquireToken(): Promise<string> {
    const missing = this.missingEnv;
    if (missing.length > 0) {
      throw new ServiceUnavailableException(
        `Integración con Microsoft Graph sin configurar. Faltan variables de entorno: ${missing.join(
          ', ',
        )}.`,
      );
    }

    const tenantId = this.configService.getOrThrow<string>('AZURE_TENANT_ID');
    const body = new URLSearchParams({
      client_id: this.configService.getOrThrow<string>('AZURE_CLIENT_ID'),
      client_secret: this.configService.getOrThrow<string>(
        'AZURE_CLIENT_SECRET',
      ),
      scope: GRAPH_SCOPE,
      grant_type: 'client_credentials',
    });

    let response: Response;
    try {
      response = await fetch(
        `${GRAPH_LOGIN_BASE_URL}/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        },
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new ServiceUnavailableException(
        `No se pudo obtener el token de Microsoft Graph: ${detail}`,
      );
    }

    const payload = (await safeJson(response)) as {
      access_token?: string;
      expires_in?: number;
      error_description?: string;
      error?: string;
    } | null;

    if (!response.ok || !payload?.access_token) {
      throw new ServiceUnavailableException(
        payload?.error_description ??
          payload?.error ??
          'Entra ID rechazó las credenciales de la aplicación.',
      );
    }

    this.cachedToken = payload.access_token;
    this.cachedExpiry = Date.now() + (payload.expires_in ?? 3300) * 1000;
    return this.cachedToken;
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const part = String(token || '').split('.')[1];
  if (!part) return {};
  try {
    const json = Buffer.from(
      part.replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
