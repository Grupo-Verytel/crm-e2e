import { triggerFromEventType, StatusHistoryTrigger } from './status-history-trigger';

describe('triggerFromEventType', () => {
  it('maps OUV funnel events to ADVANCE / RETREAT / close triggers', () => {
    expect(triggerFromEventType('ouv.avance_zona')).toBe(
      StatusHistoryTrigger.Advance,
    );
    expect(triggerFromEventType('ouv.retroceso_zona')).toBe(
      StatusHistoryTrigger.Retreat,
    );
    expect(triggerFromEventType('ouv.ganada')).toBe(StatusHistoryTrigger.Win);
    expect(triggerFromEventType('ouv.perdida')).toBe(StatusHistoryTrigger.Loss);
    expect(triggerFromEventType('ouv.descartada')).toBe(
      StatusHistoryTrigger.Discard,
    );
  });

  it('keeps APPROVAL for lead.mql_aprobado (existing status_history rows)', () => {
    expect(triggerFromEventType('lead.mql_aprobado')).toBe(
      StatusHistoryTrigger.Approval,
    );
  });

  it('falls back to MANUAL for non-state events', () => {
    expect(triggerFromEventType('ouv.checklist_item_marcado')).toBe(
      StatusHistoryTrigger.Manual,
    );
  });
});
