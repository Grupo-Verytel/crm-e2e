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
 * Buscador del header, uno por módulo (diseño Design_JD).
 *
 * Solo se habilita en los módulos cuyas páginas ya leen `query`; en el resto el
 * campo queda deshabilitado para no ofrecer una búsqueda que no hace nada.
 * Para sumar un módulo: agregar su placeholder aquí y consumir
 * `useModuleSearch().query` (`./useModuleSearch`) en sus listados.
 */
const PLACEHOLDERS: Record<string, string> = {
  'offer-closing': 'Buscar OUV, título o cliente…',
  implementation: 'Buscar SER, proyecto o cliente…',
};

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

export function ModuleSearchProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const moduleKey = resolveModuleKey(pathname);
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
    }, 300);
    return () => window.clearTimeout(handle);
  }, [draft, moduleKey]);

  const setDraft = useCallback(
    (value: string) => {
      setDraftByModule((current) => ({ ...current, [moduleKey]: value }));
    },
    [moduleKey],
  );

  const enabled = moduleKey in PLACEHOLDERS;

  const value = useMemo<ModuleSearchContextValue>(
    () => ({
      moduleKey,
      draft,
      setDraft,
      query: appliedByModule[moduleKey] ?? '',
      placeholder: PLACEHOLDERS[moduleKey] ?? DISABLED_PLACEHOLDER,
      enabled,
    }),
    [appliedByModule, draft, enabled, moduleKey, setDraft],
  );

  return (
    <ModuleSearchContext.Provider value={value}>
      {children}
    </ModuleSearchContext.Provider>
  );
}
