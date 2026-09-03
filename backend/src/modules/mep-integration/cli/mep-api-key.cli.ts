import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { MEP_LEAN_DEFAULT_SCOPES, MepScope } from '../constants/scopes';
import { ApiKeyEnvironment } from '../models';
import { ApiKeyService } from '../services/api-key.service';

/**
 * Emisión y revocación de la API key de servicio — §10.1, T-402.
 *
 * El valor claro de la clave se imprime **una sola vez**, aquí. No se guarda
 * en BD (solo su hash), no se registra en logs y no entra a Git. Entrégalo por
 * un canal seguro y descártalo de la terminal.
 *
 * Uso:
 *   npm run mep:key -- issue  --env sandbox --identity mep-lean --days 90
 *   npm run mep:key -- revoke --prefix mep_sandbox
 *
 * Rotación (§10.1): emite la clave nueva antes de revocar la anterior; ambas
 * quedan activas durante la ventana de solapamiento acordada (default 30 días).
 */
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const service = app.get(ApiKeyService);

    if (command === 'issue') {
      const environment = (args.env ?? 'sandbox') as ApiKeyEnvironment;

      if (!Object.values(ApiKeyEnvironment).includes(environment)) {
        throw new Error(
          `Ambiente inválido: ${environment}. Use sandbox | staging | production.`,
        );
      }

      const days = Number(args.days ?? 90);
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      const scopes = args.scopes
        ? (args.scopes.split(',').map((s) => s.trim()) as MepScope[])
        : MEP_LEAN_DEFAULT_SCOPES;

      const result = await service.issue({
        identity: args.identity ?? 'mep-lean',
        environment,
        scopes,
        expiresAt,
        rateTier: args.tier ?? 'default',
      });

      process.stdout.write(
        [
          '',
          'API key emitida. Este valor NO se puede recuperar después.',
          `  identidad : ${args.identity ?? 'mep-lean'}`,
          `  ambiente  : ${environment}`,
          `  prefijo   : ${result.keyPrefix}`,
          `  scopes    : ${scopes.join(', ')}`,
          `  expira    : ${expiresAt.toISOString()}`,
          '',
          `  X-API-Key: ${result.plainKey}`,
          '',
        ].join('\n'),
      );
      return;
    }

    if (command === 'revoke') {
      if (!args.prefix) {
        throw new Error('Falta --prefix con los 12 caracteres del key_prefix.');
      }

      const revoked = await service.revoke(args.prefix);
      process.stdout.write(
        revoked
          ? `Clave ${args.prefix} revocada.\n`
          : `No había una clave activa con prefijo ${args.prefix}.\n`,
      );
      return;
    }

    throw new Error('Comando desconocido. Use `issue` o `revoke`.');
  } finally {
    await app.close();
  }
}

interface ParsedArgs {
  _: string[];
  env?: string;
  identity?: string;
  days?: string;
  scopes?: string;
  tier?: string;
  prefix?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      flags[token.slice(2)] = argv[i + 1];
      i += 1;
      continue;
    }
    positional.push(token);
  }

  return { ...flags, _: positional };
}

main().catch((error: Error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
