import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { isRoleName } from '../../../lib/roles';
import { useAuth } from '../../auth/hooks/useAuth';
import { canManageDefaultAttendees } from '../lib/can-manage-default-attendees';
import { DefaultMeetingAttendeesModal } from './DefaultMeetingAttendeesModal';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    '-mb-px border-b-2 px-4 py-2 text-sm transition-colors',
    isActive
      ? 'border-accent font-bold text-accent'
      : 'border-transparent text-muted hover:text-accent',
  ].join(' ');

export function QualificationNav() {
  const { user } = useAuth();
  const [attendeesOpen, setAttendeesOpen] = useState(false);
  const showDefaultAttendees = canManageDefaultAttendees(user);
  const isInboxViewer = isRoleName(user?.role_name, 'SoporteComercial');
  const seesAllAssigned = isRoleName(
    user?.role_name,
    'DirectorMercadeo',
    'SoporteComercial',
    'Admin',
    'GestorMercadeo',
  );

  return (
    <>
      <nav
        className="mb-4 flex flex-wrap items-center gap-1 border-b border-border"
        aria-label="Calificación"
      >
        {isInboxViewer ? (
          <NavLink to="/qualification" end className={linkClass}>
            Enrutamiento
          </NavLink>
        ) : null}
        <NavLink to="/qualification/assigned" className={linkClass}>
          {seesAllAssigned ? 'SQL asignados' : 'Mis SQL'}
        </NavLink>
        {isRoleName(user?.role_name, 'SoporteComercial', 'EjecutivoComercial') ? (
          <NavLink to="/qualification/assigned-ouvs" className={linkClass}>
            OUVs Asignadas
          </NavLink>
        ) : null}
        <NavLink to="/qualification/dashboard" className={linkClass}>
          Dashboard
        </NavLink>
        {showDefaultAttendees ? (
          <button
            type="button"
            title="Invitados por defecto"
            aria-label="Invitados por defecto"
            className="ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded text-ink hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => setAttendeesOpen(true)}
          >
            <Settings size={18} aria-hidden />
          </button>
        ) : null}
      </nav>
      {attendeesOpen ? (
        <DefaultMeetingAttendeesModal onClose={() => setAttendeesOpen(false)} />
      ) : null}
    </>
  );
}
