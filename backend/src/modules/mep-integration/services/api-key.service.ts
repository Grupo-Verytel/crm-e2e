import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { MepScope } from '../constants/scopes';
import { MepApiIdentity } from '../interfaces/mep-request-context.interface';
import { ApiKeyEnvironment, MepApiKey } from '../models';

/** TTL de la cache de claves: la revocación surte efecto en ≤ 60 s (§10.1). */
const KEY_CACHE_TTL_MS = 60_000;

interface CacheEntry {
  key: MepApiKey | null;
  cachedAt: number;
}

/**
 * Emisión, verificación y revocación de la API key de servicio (§10.1).
 *
 * - En BD solo vive `sha256(pepper || clave)`; el valor claro existe una sola
 *   vez, en `issue()`, y jamás se registra en logs ni se persiste.
 * - Comparación en **tiempo constante** (`timingSafeEqual`).
 * - Formato `mep_{env}_{random_32}`; `key_prefix` = los primeros 12 caracteres,
 *   único identificador admisible en logs y auditoría (INV-31).
 * - Aislamiento por ambiente: una clave de sandbox no autentica en producción.
 * - Rotación: dos claves activas simultáneas por identidad; la vieja deja de
 *   funcionar al cerrarse su ventana (`expires_at`) o al revocarse.
 */
@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @InjectModel(MepApiKey) private readonly apiKeyModel: typeof MepApiKey,
    private readonly config: ConfigService,
  ) {}

  /** Ambiente en el que corre esta instancia del CRM. */
  get environment(): ApiKeyEnvironment {
    const raw = this.config.get<string>('MEP_API_ENVIRONMENT', 'sandbox');
    return (Object.values(ApiKeyEnvironment) as string[]).includes(raw)
      ? (raw as ApiKeyEnvironment)
      : ApiKeyEnvironment.sandbox;
  }

  /**
   * Verifica una clave presentada en `X-API-Key`.
   * Devuelve `null` en todos los casos de fallo sin distinguirlos: el guard
   * responde un `401` genérico (§10.2).
   */
  async verify(presentedKey: string): Promise<MepApiIdentity | null> {
    if (!presentedKey || presentedKey.length < 16) {
      return null;
    }

    const prefix = presentedKey.slice(0, 12);
    const record = await this.findByPrefix(prefix);

    if (!record) {
      // Se consume el mismo trabajo de hashing que en el camino feliz para no
      // filtrar por tiempo si el prefijo existe o no.
      this.hash(presentedKey);
      return null;
    }

    if (!this.hashMatches(presentedKey, record.keyHash)) {
      return null;
    }

    const now = new Date();

    if (record.revokedAt !== null && record.revokedAt <= now) {
      return null;
    }

    if (record.expiresAt <= now) {
      return null;
    }

    // Aislamiento por ambiente: una clave de sandbox nunca vale en producción.
    if (record.environment !== this.environment) {
      return null;
    }

    void this.touch(record.id, now);

    return {
      apiKeyId: record.id,
      identity: record.identity,
      environment: record.environment,
      keyPrefix: record.keyPrefix,
      scopes: this.parseScopes(record.scopes),
      rateTier: record.rateTier,
    };
  }

  /**
   * Emite una clave nueva. Devuelve el valor claro **una sola vez**; el
   * llamador es responsable de entregarlo por un canal seguro y no persistirlo.
   */
  async issue(params: {
    identity: string;
    environment: ApiKeyEnvironment;
    scopes: MepScope[];
    expiresAt: Date;
    rateTier?: string;
  }): Promise<{ plainKey: string; keyPrefix: string; id: string }> {
    const random = randomBytes(24).toString('base64url').slice(0, 32);
    const plainKey = `mep_${params.environment}_${random}`;
    const keyPrefix = plainKey.slice(0, 12);

    const record = await this.apiKeyModel.create({
      identity: params.identity,
      environment: params.environment,
      keyPrefix,
      keyHash: this.hash(plainKey),
      scopes: params.scopes,
      rateTier: params.rateTier ?? 'default',
      expiresAt: params.expiresAt,
      revokedAt: null,
      lastUsedAt: null,
    } as Partial<MepApiKey>);

    this.cache.delete(keyPrefix);
    this.logger.log(`API key emitida para ${params.identity} (${keyPrefix})`);

    return { plainKey, keyPrefix, id: record.id };
  }

  /** Revocación inmediata; la cache se invalida en el acto (§10.1). */
  async revoke(keyPrefix: string, at: Date = new Date()): Promise<boolean> {
    const [affected] = await this.apiKeyModel.update(
      { revokedAt: at },
      { where: { keyPrefix, revokedAt: null } },
    );
    this.cache.delete(keyPrefix);
    return affected > 0;
  }

  private async findByPrefix(prefix: string): Promise<MepApiKey | null> {
    const cached = this.cache.get(prefix);
    if (cached && Date.now() - cached.cachedAt < KEY_CACHE_TTL_MS) {
      return cached.key;
    }

    const key = await this.apiKeyModel.findOne({
      where: { keyPrefix: prefix },
    });
    this.cache.set(prefix, { key, cachedAt: Date.now() });
    return key;
  }

  private async touch(id: string, at: Date): Promise<void> {
    try {
      await this.apiKeyModel.update({ lastUsedAt: at }, { where: { id } });
    } catch (error) {
      // `last_used_at` es telemetría: su fallo nunca bloquea la autenticación.
      this.logger.warn(
        `No se pudo actualizar last_used_at: ${(error as Error).message}`,
      );
    }
  }

  private hash(plainKey: string): string {
    const pepper = this.config.get<string>('MEP_API_KEY_PEPPER', '');
    return createHash('sha256')
      .update(`${pepper}${plainKey}`, 'utf8')
      .digest('hex');
  }

  private hashMatches(plainKey: string, storedHash: string): boolean {
    const computed = Buffer.from(this.hash(plainKey), 'utf8');
    const stored = Buffer.from(storedHash, 'utf8');
    return (
      computed.length === stored.length && timingSafeEqual(computed, stored)
    );
  }

  private parseScopes(scopes: unknown): MepScope[] {
    if (Array.isArray(scopes)) {
      return scopes as MepScope[];
    }
    if (typeof scopes === 'string') {
      try {
        return JSON.parse(scopes) as MepScope[];
      } catch {
        return [];
      }
    }
    return [];
  }
}
