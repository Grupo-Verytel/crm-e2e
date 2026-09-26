/**
 * Internal idempotency scope — §9.1.
 *
 * The HTTP path alone is not enough for response publish: MEP may reuse the
 * same `Idempotency-Key` when advancing `response_version` (1 → 2 → 3). Each
 * version is a distinct write; retries must replay only within the same version.
 */
export function idempotencyPathForResponsePublish(
  httpPath: string,
  responseVersion: number,
): string {
  return `${httpPath}#response_version=${responseVersion}`;
}
