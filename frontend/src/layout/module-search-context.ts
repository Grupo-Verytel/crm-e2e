import { createContext } from 'react';

export type ModuleSearchContextValue = {
  moduleKey: string;
  /** Valor inmediato del input del header. */
  draft: string;
  setDraft: (value: string) => void;
  /** Valor con debounce, el que disparan los fetch. */
  query: string;
  placeholder: string;
  enabled: boolean;
};

export const ModuleSearchContext =
  createContext<ModuleSearchContextValue | null>(null);
