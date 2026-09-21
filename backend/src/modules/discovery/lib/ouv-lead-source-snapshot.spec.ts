import { snapshotLeadSource } from './ouv-lead-source-snapshot';

describe('snapshotLeadSource', () => {
  it('copies lead origen and canal_origen onto English OUV columns', () => {
    expect(
      snapshotLeadSource({
        origen: 'Email Marketing',
        canal_origen: 'CAMPANA_DIGITAL',
      }),
    ).toEqual({
      origin: 'Email Marketing',
      sourceChannel: 'CAMPANA_DIGITAL',
    });
  });

  it('stores null when the lead has no origin values (direct-style empty)', () => {
    expect(snapshotLeadSource({ origen: null, canal_origen: null })).toEqual({
      origin: null,
      sourceChannel: null,
    });
    expect(snapshotLeadSource({ origen: '  ', canal_origen: '' })).toEqual({
      origin: null,
      sourceChannel: null,
    });
  });
});
