import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { NAV_ITEMS } from '../lib/navigation';
import {
  ModuleSearchContext,
  type ModuleSearchContextValue,
} from './module-search-context';

/**
 * Header search, one draft per module. Typing applies after a short pause.
 * Enabled only on the list routes that actually read `query`.
 */
const SEARCH_ROUTES: Array<{
  match: (pathname: string) => boolean;
  placeholder: string;
}> = [
  {
    match: (pathname) => pathname === '/demand',
    placeholder: 'Buscar lead, empresa, NIT o contacto…',
  },
  {
    match: (pathname) =>
      pathname === '/qualification' || pathname === '/qualification/assigned',
    placeholder: 'Buscar SQL, empresa o contacto…',
  },
  {
    match: (pathname) =>
      pathname === '/opportunities' ||
      pathname === '/opportunities/ganadas' ||
      pathname === '/opportunities/perdidas' ||
      pathname === '/opportunities/descartadas',
    placeholder: 'Buscar OUV, título o cliente…',
  },
  {
    match: (pathname) => pathname === '/offers',
    placeholder: 'Buscar OUV, título o cliente…',
  },
  {
    match: (pathname) =>
      pathname === '/services' || pathname === '/services/reportes',
    placeholder: 'Buscar SER, proyecto o cliente…',
  },
  {
    match: (pathname) => pathname === '/after-sales',
    placeholder: 'Buscar novedad, cliente o servicio…',
  },
];

const DISABLED_PLACEHOLDER = 'Usa los filtros de la página para buscar';

function resolveModuleKey(pathname: string): string {
  const match = [...NAV_ITEMS]
    .sort((a, b) => b.path.length - a.path.length)
    .find(
      (item) =>
        pathname === item.path || pathname.startsWith(`${item.path}/`),
    );
  return match?.key ?? 'unknown';
}

function resolveSearch(pathname: string) {
  return SEARCH_ROUTES.find((route) => route.match(pathname));
}

export function ModuleSearchProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const moduleKey = resolveModuleKey(pathname);
  const search = resolveSearch(pathname);
  const [draftByModule, setDraftByModule] = useState<Record<string, string>>(
    {},
  );
  const [appliedByModule, setAppliedByModule] = useState<
    Record<string, string>
  >({});

  const draft = draftByModule[moduleKey] ?? '';

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setAppliedByModule((current) => {
        const next = draft.trim();
        if ((current[moduleKey] ?? '') === next) return current;
        return { ...current, [moduleKey]: next };
      });
    }, 280);
    return () => window.clearTimeout(handle);
  }, [draft, moduleKey]);

  const setDraft = useCallback(
    (value: string) => {
      setDraftByModule((current) => ({ ...current, [moduleKey]: value }));
    },
    [moduleKey],
  );

  const enabled = Boolean(search);

  const value = useMemo<ModuleSearchContextValue>(
    () => ({
      moduleKey,
      draft,
      setDraft,
      query: appliedByModule[moduleKey] ?? '',
      placeholder: search?.placeholder ?? DISABLED_PLACEHOLDER,
      enabled,
    }),
    [appliedByModule, draft, enabled, moduleKey, search?.placeholder, setDraft],
  );

  return (
    <ModuleSearchContext.Provider value={value}>
      {children}
    </ModuleSearchContext.Provider>
  );
}
