import { CanalOrigen } from '../models/enums/lead.enums';

export function isReferidoCanal(
  canalOrigen: string | null | undefined,
): boolean {
  return canalOrigen === CanalOrigen.Referido;
}

/** Free-text referrer is only stored when canal_origen is REFERIDO. */
export function resolveReferrerName(
  canalOrigen: string | null | undefined,
  name?: string | null,
): string | null {
  if (!isReferidoCanal(canalOrigen)) {
    return null;
  }
  const trimmed = name?.trim();
  return trimmed ? trimmed : null;
}
