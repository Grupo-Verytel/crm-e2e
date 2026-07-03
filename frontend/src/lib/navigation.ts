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
  // CASL subjects that gate this module. The item is shown when the user's role
  // has at least one permission on any of these subjects (matches the backend
  // RBAC matrix in role-permissions.js). `qualification` has no dedicated
  // subject yet, so it rides on Lead (marketing-owned MOFU stage).
  subjects: string[];
};

export const NAV_ITEMS: NavItem[] = [
  // Commercial — the 8 phases
  { key: 'demand-generation',     label: 'Generación de demanda', path: '/demand',        icon: Megaphone,     group: 'commercial', subjects: ['Lead', 'Campaign'] },
  { key: 'qualification',         label: 'Calificación',          path: '/qualification', icon: Filter,        group: 'commercial', subjects: ['Lead'] },
  { key: 'discovery',             label: 'Oportunidades (OUV)',   path: '/opportunities', icon: Compass,       group: 'commercial', subjects: ['Opportunity'] },
  { key: 'technical-feasibility', label: 'Preventa (PRE)',        path: '/presales',      icon: Cpu,           group: 'commercial', subjects: ['Presale'] },
  { key: 'pricing',               label: 'Pricing (PRI)',         path: '/pricing',       icon: Calculator,    group: 'commercial', subjects: ['Pricing'] },
  { key: 'offer-closing',         label: 'Oferta & Cierre',       path: '/offers',        icon: FileSignature, group: 'commercial', subjects: ['Proposal', 'Contract'] },
  { key: 'implementation',        label: 'Implementación (SER)',  path: '/services',      icon: Wrench,        group: 'commercial', subjects: ['Service'] },
  { key: 'post-sales',            label: 'Posventa',              path: '/after-sales',   icon: RefreshCw,     group: 'commercial', subjects: ['PostSale'] },
  // Platform — the +2
  { key: 'auth',                  label: 'Usuarios y roles',      path: '/admin/users',   icon: ShieldCheck,   group: 'platform',   subjects: ['User', 'Role'] },
  { key: 'audit',                 label: 'Auditoría',             path: '/admin/audit',   icon: ScrollText,    group: 'platform',   subjects: ['AuditLog'] },
];

/** True when the role has any permission on at least one of the item's subjects. */
export function canAccessNavItem(
  permissions: { subject: string }[] | undefined,
  item: NavItem,
): boolean {
  if (!permissions || permissions.length === 0) {
    return false;
  }
  return permissions.some((rule) => item.subjects.includes(rule.subject));
}
