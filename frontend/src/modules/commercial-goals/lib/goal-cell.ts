export function goalCellKey(userId: string, segmentId: string): string {
  return `${userId}:${segmentId}`;
}
