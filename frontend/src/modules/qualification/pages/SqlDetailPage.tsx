import { useEffect, useState } from 'react';

import { Link, useNavigate, useParams } from 'react-router-dom';

import { AppLayout } from '../../../layout/AppLayout';

import { useAuth } from '../../auth/hooks/useAuth';

import { hasPermission } from '../../auth/lib/permission-catalog';

import { fetchSql, type SqlDetail } from '../api/sqls-api';

import { ConvertirSqlEnOuvModal } from '../components/ConvertirSqlEnOuvModal';

import {

  SqlAgendaStatusModule,

  SqlPlannedCitaModule,

  SqlScheduledCitaModule,

} from '../components/SqlAgendaPanel';

import { SqlDetailInfoModule } from '../components/SqlDetailInfoModule';

import { QualificationNav } from '../components/QualificationNav';

import { cardClass, ghostButtonClass } from '../components/ui';



function sqlAccentId(sql: SqlDetail): string {

  const raw = sql.sql_id.replace(/-/g, '').slice(0, 6).toUpperCase();

  return `SQL-${raw}`;

}



export function SqlDetailPage() {

  const { id } = useParams<{ id: string }>();

  const navigate = useNavigate();

  const { user } = useAuth();

  const [sql, setSql] = useState<SqlDetail | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [showConvertModal, setShowConvertModal] = useState(false);



  const canAssign =

    user?.role_name === 'Admin' ||

    hasPermission(user?.permissions, 'assign', 'Sql');

  const backHref = canAssign ? '/qualification' : '/qualification/assigned';



  useEffect(() => {

    if (!id) {

      return;

    }

    let cancelled = false;

    async function load() {

      setIsLoading(true);

      setError(null);

      try {

        const data = await fetchSql(id!);

        if (!cancelled) {

          setSql(data);

        }

      } catch {

        if (!cancelled) {

          setError('No se pudo cargar el SQL.');

        }

      } finally {

        if (!cancelled) {

          setIsLoading(false);

        }

      }

    }

    void load();

    return () => {

      cancelled = true;

    };

  }, [id]);



  const canConvert =

    hasPermission(user?.permissions, 'create', 'Sql') &&

    sql?.estado === 'Asignado' &&

    sql.comercial_asignado_id === user?.user_id;



  return (

    <AppLayout title="Calificación">

      <QualificationNav />

      <div className="mb-4">

        <Link to={backHref} className={`${ghostButtonClass} inline-block`}>

          ← Volver

        </Link>

      </div>



      {isLoading ? <p className="text-sm text-muted">Cargando…</p> : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}



      {sql ? (

        <>

          <section className={`${cardClass} mb-4 p-5`}>

            <p className="text-xs font-bold text-accent">{sqlAccentId(sql)}</p>

            <h1 className="mt-1 text-lg font-bold text-ink">

              {String(sql.lead.empresa_nombre ?? 'SQL')}

            </h1>

            <p className="text-sm text-muted">

              {[sql.lead.contacto_nombre, sql.lead.email]

                .filter((value) => typeof value === 'string' && value.length > 0)

                .join(' · ') || 'Sin contacto'}

            </p>

          </section>



          <div className="grid gap-4 lg:grid-cols-2">

            <SqlDetailInfoModule

              sql={sql}

              canConvert={Boolean(canConvert)}

              onConvert={() => setShowConvertModal(true)}

            />

            <SqlAgendaStatusModule

              citaPlanificada={sql.cita_planificada}

              cita={sql.cita}

            />

            <SqlPlannedCitaModule

              citaPlanificada={sql.cita_planificada}

              cita={sql.cita}

            />

            <SqlScheduledCitaModule cita={sql.cita} />

          </div>

        </>

      ) : null}



      {showConvertModal && sql ? (

        <ConvertirSqlEnOuvModal

          sql={sql}

          onClose={() => setShowConvertModal(false)}

          onConverted={(ouvId) => {

            navigate(`/opportunities/${ouvId}`);

          }}

        />

      ) : null}

    </AppLayout>

  );

}



export default SqlDetailPage;

