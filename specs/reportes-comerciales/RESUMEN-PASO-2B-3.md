# RESUMEN-PASO-2B-3 — Navegación y usabilidad de Reportes

**Fecha:** 2026-10-28
**Rama:** `EP-Feature-Reportes` (sobre `02b0d42`)
**Alcance:** solo frontend. Endpoints y contratos sin cambio. Sin commit.

## 1. Navegación

El sidebar agrupa los ítems en Comercial, Reportes y Plataforma. Un grupo sin ítems visibles no pinta encabezado: `Sidebar.tsx` arma los tres grupos y descarta el que queda vacío.

«Reportes» salió de Comercial. El grupo Reportes tiene dos ítems planos, ambos con `subjects: ['CommercialReport']` y `actions: ['read']`, el mismo `canAccessNavItem` del resto del menú:

- Comité comercial → `/reports/committee` (`Presentation`)
- Salud del pipeline → `/reports/pipeline-health` (`HeartPulse`)

`/reports` redirige a `/reports/committee` y conserva el query string. No quedan pestañas internas. El enlace del tablero de OUVs va a `/reports/committee` y sigue usando `hasCommercialReportPermission`, que llama a ese mismo `canAccessNavItem`.

En este workspace hay `.js` emitidos al lado de los `.ts` (no están en git). Vite los prefiere y esos `.js` arman otro contexto de auth. Por eso el comité y el tablero importan `useAuth.ts`, `AppLayout.tsx` y, en el tablero, `DiscoveryNav.tsx`.

Rol sin `CommercialReport`: no se inició sesión (no hay cuenta de QA y no se cambiaron contraseñas). En código, si ningún ítem del grupo pasa el chequeo, el arreglo del grupo queda vacío y el encabezado no se renderiza.

## 2. Filtros

Comité: año, trimestre, desde, hasta, comercial y segmento. Se editan en borrador y se aplican con «Aplicar». La fecha de corte no está en esa barra: vive en el encabezado de M003, con «Hace 7 días» (default), «Hace 14 días» y «Personalizada». El texto del bloque dice que esa fecha solo actualiza la movilización. El endpoint sigue devolviendo el comité completo, así que hay un refetch, y las cifras de M035 no cambian.

Salud: solo comercial y segmento. No hay año, trimestre ni rango.

Bajo la barra, el resumen aplicado va en `text-muted` (el token de texto atenuado; no existe `text-ink-muted`) y el botón «Limpiar». Aplicar y la fecha de corte escriben la query. Atrás del navegador restaura la ruta y los controles.

## 3. Bloques

Cada bloque lleva badge de base de tiempo: `Q3 2026`, `Desde 21-oct-2026` o `Al día de hoy`. Las cifras son botones con foco visible, subrayado en hover y `aria-label` «Ver detalle de …». Las notas largas son un ícono `Info` con `title` y `aria-label`: OUVs frente a eventos, monto actual, historial de montos incompleto, y sintéticos excluidos solo si el conteo es mayor que 0. Si M003 no tiene movimientos, el bloque dice «Sin movimientos desde el …».

Título y pregunta:

- Comité comercial: «¿Qué cambió desde el último comité y cómo está el periodo?»
- Salud del pipeline: «¿Cuántas OUVs abiertas llevan más de un año y cuál es su edad?»

Los componentes compartidos (barra, badge, cifra, nota, atajos de corte) están en `frontend/src/modules/reports/components/`.

## 4. Pantallas (Admin, CRM Administrator)

**Sidebar.** Comercial va de Leads a Posventa, sin «Reportes». Luego Reportes, con Comité comercial y Salud del pipeline. Luego Plataforma: Empresas, Contactos, Usuarios y roles, Auditoría.

**Comité, Q3 2026, corte 21 oct 2026 (default «Hace 7 días»).** Resumen: «Q3 2026 · Todos los comerciales · Todos los segmentos». M003 badge «Desde 21-oct-2026»: movilizadas 2 (2 eventos, $25 M), nuevas 1, zona 0, monto 1, ganadas 0, perdidas 0. M035 badge «Q3 2026»: avances 78 (100, $57.889 M), retrocesos 24 (25), cierres 39 (43), reaperturas 4 (6). M025: 80. Sin fecha prevista: 27. Los íconos de info incluyen «7 movimientos sintéticos quedaron fuera del conteo».

**Corte «Hace 14 días».** La URL queda `fecha_corte=2026-10-14`. M003 pasa a 15 OUVs (24 eventos) y cambios de zona a 1. Avances sigue en 78 (100). Badge «Desde 14-oct-2026».

**URL copiada.** `?year=2026&quarter=3&fecha_corte=2026-10-14&segmento=Gobierno+central`, abierta de nuevo: año 2026, trimestre 3, segmento Gobierno central, atajo de 14 días activo. M025 de ese segmento: 38. Avances del segmento: 26 (27).

**Salud.** Sin año, trimestre, rango ni fecha de corte. Quedan comercial y segmento. Badge «Al día de hoy». Rangos 10 ($26.347 M), 1 ($1.918 M) y 0. La pregunta de la página está visible. Atrás vuelve al comité con el query anterior.

**`/reports?segmento=Gobierno+central`.** Redirige a `/reports/committee` con el mismo segmento.

**Tablero de OUVs.** El enlace «Reportes» apunta a `/reports/committee`.

## 5. Build

`tsc -b` y `vite build`, en verde. ESLint acotado a navegación, páginas de reportes y tablero, y `frontend/src/modules/reports`, sin `--fix`, en verde.

Sin commit.

🛑 STOP.
