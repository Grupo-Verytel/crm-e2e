import { ConfigService } from '@nestjs/config';
import {
  MAX_IN_FLIGHT_PER_KEY,
  RateLimitClass,
} from '../constants/rate-limit.constants';
import { RateLimitService } from './rate-limit.service';

describe('rate limiting — §11', () => {
  let service: RateLimitService;

  beforeEach(() => {
    const config = {
      get: (_key: string, fallback?: unknown) => fallback,
    } as unknown as ConfigService;
    service = new RateLimitService(config);
  });

  const consume = (key: string, cls: RateLimitClass, now: number) =>
    service.consume(key, cls, 'production', 'default', now);

  it('TS-RL-01: agotado el bucket de escritura, la siguiente petición se bloquea con Retry-After', () => {
    const now = Date.now();
    // Capacidad de la clase `write` en producción: 120 sostenido + 40 burst.
    for (let i = 0; i < 160; i += 1) {
      expect(consume('key-a', RateLimitClass.WRITE, now).allowed).toBe(true);
    }

    const blocked = consume('key-a', RateLimitClass.WRITE, now);

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetSeconds).toBeGreaterThan(0);
  });

  it('TS-RL-02: la decisión siempre trae los datos de los headers RateLimit-*', () => {
    const decision = consume('key-b', RateLimitClass.READ_LIST, Date.now());

    expect(decision.limit).toBe(60);
    expect(decision.windowSeconds).toBe(60);
    expect(decision.remaining).toBeGreaterThanOrEqual(0);
    expect(decision.resetSeconds).toBeGreaterThanOrEqual(0);
  });

  it('TS-RL-03: tras la reposición del bucket, la siguiente petición pasa', () => {
    const now = Date.now();
    for (let i = 0; i < 80; i += 1) {
      consume('key-c', RateLimitClass.READ_LIST, now);
    }
    expect(consume('key-c', RateLimitClass.READ_LIST, now).allowed).toBe(false);

    // Un minuto después el bucket sostenido se repuso por completo.
    const later = now + 60_000;
    expect(consume('key-c', RateLimitClass.READ_LIST, later).allowed).toBe(
      true,
    );
  });

  it('TS-RL-06: agotar `read-list` no bloquea la clase `write`', () => {
    const now = Date.now();
    for (let i = 0; i < 81; i += 1) {
      consume('key-d', RateLimitClass.READ_LIST, now);
    }
    expect(consume('key-d', RateLimitClass.READ_LIST, now).allowed).toBe(false);

    expect(consume('key-d', RateLimitClass.WRITE, now).allowed).toBe(true);
  });

  it('TS-RL-07: dos API keys distintas tienen cuotas aisladas', () => {
    const now = Date.now();
    for (let i = 0; i < 81; i += 1) {
      consume('key-e', RateLimitClass.READ_LIST, now);
    }
    expect(consume('key-e', RateLimitClass.READ_LIST, now).allowed).toBe(false);

    expect(consume('key-f', RateLimitClass.READ_LIST, now).allowed).toBe(true);
  });

  it('§11.1: sandbox opera con un cuarto de los límites de producción', () => {
    const production = service.consume(
      'key-g',
      RateLimitClass.WRITE,
      'production',
      'default',
      Date.now(),
    );
    service.reset();
    const sandbox = service.consume(
      'key-g',
      RateLimitClass.WRITE,
      'sandbox',
      'default',
      Date.now(),
    );

    expect(production.limit).toBe(120);
    expect(sandbox.limit).toBe(30);
  });

  it('§11.1: la concurrencia por key se limita a 20 in-flight', () => {
    for (let i = 0; i < MAX_IN_FLIGHT_PER_KEY; i += 1) {
      expect(service.acquireSlot('key-h')).toBe(true);
    }

    expect(service.acquireSlot('key-h')).toBe(false);

    service.releaseSlot('key-h');
    expect(service.acquireSlot('key-h')).toBe(true);
  });

  it('§11.3: el limitador reporta que opera en modo degradado (sin Redis)', () => {
    expect(service.degraded).toBe(true);
  });
});
