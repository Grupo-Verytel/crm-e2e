import { isDatabaseUnavailableError } from './is-database-unavailable-error';

describe('isDatabaseUnavailableError', () => {
  it('detects Sequelize host-not-found errors', () => {
    const error = Object.assign(new Error('getaddrinfo ENOTFOUND'), {
      name: 'SequelizeHostNotFoundError',
      parent: { code: 'ENOTFOUND' },
    });

    expect(isDatabaseUnavailableError(error)).toBe(true);
  });

  it('detects connection refused by driver code', () => {
    const error = { name: 'Error', parent: { code: 'ECONNREFUSED' } };
    expect(isDatabaseUnavailableError(error)).toBe(true);
  });

  it('does not treat generic auth failures as DB outages', () => {
    expect(isDatabaseUnavailableError(new Error('INVALID_REFRESH_TOKEN'))).toBe(
      false,
    );
    expect(isDatabaseUnavailableError({ name: 'JsonWebTokenError' })).toBe(
      false,
    );
  });
});
