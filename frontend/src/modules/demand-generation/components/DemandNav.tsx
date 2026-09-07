import { Link, useLocation } from 'react-router-dom';

const DEVUELTAS_PARAM = 'bandeja';
const DEVUELTAS_VALUE = 'devueltas';

/**
 * Back link to the Leads board — only on the "OUV devueltas" tray.
 * Matches the OUV detail “← Bandeja OUV” link style.
 */
export function DemandNav() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const onDevueltas =
    location.pathname === '/demand' &&
    params.get(DEVUELTAS_PARAM) === DEVUELTAS_VALUE;

  if (!onDevueltas) {
    return null;
  }

  return (
    <div className="mb-3">
      <Link
        to={{ pathname: '/demand', search: '' }}
        className="text-sm text-accent hover:underline"
      >
        ← Bandeja Leads
      </Link>
    </div>
  );
}
