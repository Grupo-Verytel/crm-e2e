import { Segmento } from '../models/enums/segment.enum';

/** Snapshot passed to qualification for ICP scoring (implemented in qualification module). */
export interface LeadIcpSnapshot {
  leadId: string;
  segmento: Segmento;
  industria: string | null;
  region: string;
  pais: string;
  origen: string;
  empresaNombre: string;
}

/**
 * Port for ICP score calculation — owned by qualification, consumed here later.
 * Demand-generation only persists the returned score (EARS-DEM-16).
 */
export interface IcpScoreCalculatorPort {
  calculateIcpScore(snapshot: LeadIcpSnapshot): Promise<number>;
}

export const ICP_SCORE_CALCULATOR_PORT = Symbol('ICP_SCORE_CALCULATOR_PORT');
