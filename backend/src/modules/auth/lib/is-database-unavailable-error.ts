/**
 * Detects Sequelize / driver failures that mean the DB is unreachable.
 * Used so auth guards do not convert infrastructure outages into 401s
 * (which the frontend treats as session expiry).
 */
export function isDatabaseUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as {
    name?: string;
    code?: string;
    parent?: { code?: string };
    original?: { code?: string };
  };

  const name = err.name ?? '';
  const connectionNames = [
    'SequelizeHostNotFoundError',
    'SequelizeConnectionError',
    'SequelizeConnectionRefusedError',
    'SequelizeConnectionTimedOutError',
    'SequelizeAccessDeniedError',
    'ConnectionError',
    'HostNotFoundError',
  ];

  if (connectionNames.some((candidate) => name === candidate || name.includes(candidate))) {
    return true;
  }

  const codes = [err.code, err.parent?.code, err.original?.code].filter(
    (code): code is string => typeof code === 'string',
  );
  const connectionCodes = [
    'ENOTFOUND',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EHOSTUNREACH',
    'ECONNRESET',
    'PROTOCOL_CONNECTION_LOST',
  ];

  return connectionCodes.some((code) => codes.includes(code));
}
