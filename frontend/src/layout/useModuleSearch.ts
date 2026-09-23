import { useContext } from 'react';
import {
  ModuleSearchContext,
  type ModuleSearchContextValue,
} from './module-search-context';

export function useModuleSearch(): ModuleSearchContextValue {
  const context = useContext(ModuleSearchContext);
  if (!context) {
    throw new Error('useModuleSearch must be used within ModuleSearchProvider');
  }
  return context;
}
