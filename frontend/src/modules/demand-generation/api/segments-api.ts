import { apiRequest } from '../../../lib/api/http-client';
import type { Segment } from '../types';

export async function fetchSegments(): Promise<Segment[]> {
  return apiRequest<Segment[]>('/segments');
}
