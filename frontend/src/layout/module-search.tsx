import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { NAV_ITEMS } from '../lib/navigation';

const PLACEHOLDERS: Record<string, string> = {
  'demand-generation': 'Buscar leads, empresa, NIT o campaña…',
  qualification: 'Buscar SQL, empresa o contacto…',
  discovery: 'Buscar OUV, título o empresa…',
  'technical-feasibility': 'La búsqueda estará disponible con Preventa',
  pricing: 'La búsqueda estará disponible con Pricing',
  'offer-closing': 'Buscar OUV, título o cliente…',
  implementation: 'Buscar SER, proyecto o cliente…',
  'post-sales': 'La búsqueda estará disponible con Posventa',
  'accounts-empresas': 'Buscar empresa o NIT…',
  'accounts-contactos': 'Buscar contacto, email, teléfono o empresa…',
  auth: 'Buscar usuario, email o rol…',
  audit: 'Buscar tabla, acción, actor o IP…',
};

const SEARCHABLE_MODULES = new Set(Object.keys(PLACEHOLDERS).filter(
  (key) =>
    key !== 'technical-feasibility' &&
    key !== 'pricing' &&
    key !== 'post-sales',
));

function resolveModuleKey(pathname: string): string {
  const match = [...NAV_ITEMS]
    .sort((a, b) => b.path.length - a.path.length)
    .find(
      (item) =>
        pathname === item.path || pathname.startsWith(`${item.path}/`),
    );
  return match?.key ?? 'unknown';
}

type ModuleSearchContextValue = {
  moduleKey: string;
  /** Immediate input value (header). */
  draft: string;
  setDraft: (value: string) => void;
  /** Debounced value for fetching. */
  query: string;
  placeholder: string;
  enabled: boolean;
};

const ModuleSearchContext = createContext<ModuleSearchContextValue | null>(
  null,
);

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

  const value = useMemo<ModuleSearchContextValue>(
    () => ({
      moduleKey,
      draft,
      setDraft,
      query: appliedByModule[moduleKey] ?? '',
      placeholder:
        PLACEHOLDERS[moduleKey] ?? 'Buscar en este módulo…',
      enabled: SEARCHABLE_MODULES.has(moduleKey),
    }),
    [appliedByModule, draft, moduleKey, setDraft],
  );

  return (
    <ModuleSearchContext.Provider value={value}>
      {children}
    </ModuleSearchContext.Provider>
  );
}

export function useModuleSearch(): ModuleSearchContextValue {
  const context = useContext(ModuleSearchContext);
  if (!context) {
    throw new Error('useModuleSearch must be used within ModuleSearchProvider');
  }
  return context;
}
