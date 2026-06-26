// Sidebar navigation: the 10 modules. Labels in Spanish (UI), keys in English (code).
// Domain terms (OUV, Preventa, Pricing) kept in Spanish on purpose.
import type { ComponentType } from 'react';
import {
  Megaphone, Filter, Compass, Cpu, Calculator, FileSignature,
  Wrench, RefreshCw, ShieldCheck, ScrollText,
} from 'lucide-react';

export type NavItem = {
  key: string;
  label: string;
  path: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  group: 'commercial' | 'platform';
};

export const NAV_ITEMS: NavItem[] = [
  // Commercial — the 8 phases
  { key: 'demand-generation',     label: 'Generación de demanda', path: '/demand',        icon: Megaphone,     group: 'commercial' },
  { key: 'qualification',         label: 'Calificación',          path: '/qualification', icon: Filter,        group: 'commercial' },
  { key: 'discovery',             label: 'Oportunidades (OUV)',   path: '/opportunities', icon: Compass,       group: 'commercial' },
  { key: 'technical-feasibility', label: 'Preventa (PRE)',        path: '/presales',      icon: Cpu,           group: 'commercial' },
  { key: 'pricing',               label: 'Pricing (PRI)',         path: '/pricing',       icon: Calculator,    group: 'commercial' },
  { key: 'offer-closing',         label: 'Oferta & Cierre',       path: '/offers',        icon: FileSignature, group: 'commercial' },
  { key: 'implementation',        label: 'Implementación (SER)',  path: '/services',      icon: Wrench,        group: 'commercial' },
  { key: 'post-sales',            label: 'Posventa',              path: '/after-sales',   icon: RefreshCw,     group: 'commercial' },
  // Platform — the +2
  { key: 'auth',                  label: 'Usuarios y roles',      path: '/admin/users',   icon: ShieldCheck,   group: 'platform' },
  { key: 'audit',                 label: 'Auditoría',             path: '/admin/audit',   icon: ScrollText,    group: 'platform' },
];
