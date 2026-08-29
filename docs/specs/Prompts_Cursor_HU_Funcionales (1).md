# Prompts para Cursor — HU Funcionales CRM · Control de Proyectos
Metodología aplicada: **Spec-Driven Development** (Requirements → Design → Tasks → Implementation).
Alcance: únicamente las 8 HU funcionales (HU-F01 a HU-F08), todas dentro de **un mismo módulo** del CRM (Oportunidades/Proyectos). Se excluyen las HU backend (HU-B01 a HU-B06).
Restricción transversal: se mantiene la capa visual actual del CRM Frisson (sidebar oscuro con módulos Comercial/Plataforma, topbar con buscador/notificaciones/perfil, tabs horizontales, bloque de filtros, tabla con badges de Zona/Resultado y toggle Lista/Kanban).

**Corrección aplicada en esta versión:** se identificaron reglas y funcionalidades que se repetían de forma implícita en más de una HU. Para evitar que Cursor reconstruya lo mismo dos veces dentro del mismo módulo, se creó una sección de **Componentes y Modelos Compartidos** que cada prompt referencia explícitamente en lugar de redefinir la lógica.

---

## Design System de referencia (incluir en cada prompt / contexto de Cursor)

```
DESIGN SYSTEM ACTUAL - FRISSON CRM (NO MODIFICAR)
- Tema oscuro: fondo #1A1A1A/#1E1E1E, texto blanco/gris claro, acento naranja #FF6A00 para estados activos, botones primarios y badges destacados.
- Sidebar izquierdo colapsable con logo "Frisson CRM", agrupado en secciones "COMERCIAL" (Generación de demanda, Calificación, Oportunidades (OUV), Preventa (PRE), Pricing (PRI), Oferta & Cierre, Implementación (SER), Posventa) y "PLATAFORMA" (Empresas, Contactos, Usuarios y roles, Auditoría). Botón "Salir" fijo al pie.
- Topbar superior: título de la página activa a la izquierda, buscador global centrado ("Buscar oportunidades, cuentas, contactos..."), y a la derecha ícono de notificaciones, toggle de tema claro/oscuro, avatar circular con iniciales + nombre/rol, botón "Salir".
- Navegación secundaria por tabs horizontales debajo del topbar (ej. "Bandeja OUV", "Motivos pérdida", "Motivos descarte", "Checklist zonas"), tab activo subrayado en naranja.
- Encabezado de sección con título y, cuando aplique, toggle de vista "Lista/Kanban" alineado a la derecha (botón activo relleno naranja, inactivo outline).
- Bloque de filtros en tarjeta: inputs de texto, selects ("Todas"/"Todos" por defecto), date pickers "Desde"/"Hasta", botones "Aplicar filtros" (relleno naranja) y "Limpiar" (outline naranja).
- Tablas con columnas tipo Consecutivo (link naranja), Título/Nombre, Empresa/Cliente, badges de estado con colores semánticos (verde=positivo, gris/teal=neutro, azul=informativo, naranja=alerta/en proceso), columna de estado tipo pill oscuro (ej. "EnCurso"), y fecha de creación/actualización.
- Cualquier pantalla nueva debe integrarse a este sidebar/topbar sin romper el patrón existente, reutilizando los mismos componentes de tabla, tabs, filtros y badges.
```

---

## Componentes y Modelos Compartidos (leer antes de implementar cualquier HU)

Estos elementos deben construirse **una sola vez** y ser consumidos por las HU que se indican. Ningún prompt individual debe recrearlos desde cero; debe importarlos/referenciarlos.

### C1. Componente `AlertaBadge` / `AlertaBanner`
- **Usado por:** HU-F01 (alerta hacia el KAM cuando una validación queda pendiente/rechazada) y HU-F08 (alertas operativas del proyecto).
- **Definición única:** tipo de alerta, estado (Pendiente/Activa/Resuelta), descripción y fecha. Solo cambia el **disparador** (validación comercial vs. alerta operativa de Control de Proyectos), no el componente visual.
- **Regla:** ninguna de las dos HU debe construir su propio badge de alerta; ambas consumen `AlertaBadge`.

### C2. Componente `CSATIndicator` (solo lectura y editable)
- **Usado por:** HU-F03 (campo CSAT dentro del resumen de envío, solo lectura), HU-F06 (dashboard de desempeño, solo lectura) y HU-F08 (captura/edición del índice, habilitada solo para roles Gestor de Mercadeo / Director de Mercadeo).
- **Definición única:** un mismo componente con dos modos (`readOnly` / `editable`). F03 y F06 lo instancian en modo lectura; F08 lo instancia en modo edición controlado por rol.
- **Regla:** no crear tres componentes de satisfacción distintos; es el mismo dato en tres puntos de consumo.

### C3. Modelo `IndicadoresProyecto` (Costos, Tiempo, Alcance, Facturación, Documentación)
- **Usado por:** HU-F03 (listado de campos a enviar/retornar en el resumen) y HU-F06 (tarjetas del dashboard de desempeño).
- **Regla:** ambos consumen la misma interfaz de datos mock (`IndicadoresProyecto`). F03 los muestra en modo resumen/checklist; F06 los muestra en modo dashboard. No se generan dos estructuras de datos paralelas para el mismo indicador.

### C4. Modelo `DatosBaseProyecto` (nombre, fechas, valor a facturar, costo estimado, recurrente/no recurrente, participación y % por empresa)
- **Capturado en:** HU-F01 (empresa ejecutora, UT y % de participación) y HU-F04 (nombre, fechas, valor, costo, recurrente/no recurrente).
- **Consumido en:** HU-F03 (resumen de envío a PMO), que **muestra estos campos en solo lectura**, tomándolos del mismo modelo ya capturado — no vuelve a renderizar los selectores de HU-F01/HU-F04.
- **Regla:** HU-F03 es una vista de confirmación, no un formulario nuevo.

### C5. Vista base "Reportes de Proyecto" (tabla + filtros compartidos)
- **Usado por:** HU-F05 (trazabilidad de nombre/oportunidad/consecutivos) y HU-F07 (filtro de ejecución por contexto comercial).
- **Definición única:** ambas HU son **dos tabs de una misma vista de reportes**, reutilizando la misma tabla base y el mismo patrón de filtros del design system (como "Bandeja OUV"). HU-F05 agrega columnas de homologación/consecutivo; HU-F07 agrega filtros por oportunidad/cliente/vendedor y control de visibilidad por rol.
- **Regla:** no crear dos pantallas de tabla+filtros independientes; es una vista con dos tabs que comparten el componente de tabla y el data source base de "proyectos".

### C6. Formulario base de datos del proyecto (reutilizado para "Ampliar proyecto")
- **Definido en:** HU-F04 (formulario de captura inicial).
- **Reutilizado en:** HU-F06, acción "Ampliar proyecto" (funcionalidad trasladada desde Control de Proyectos al CRM). Debe reutilizar el mismo formulario/componentes de HU-F04 en modo edición, no crear un formulario nuevo.
- **Nota:** el documento fuente no detalla los campos exactos de "Ampliar proyecto"; se infiere razonable reutilizar el formulario base de F04, y esto debe quedar así de explícito para quien implemente.

### Mapa de dependencias entre HU (para el orden de desarrollo)
```
HU-F01 (captura empresa ejecutora/UT/%) ─┐
HU-F04 (captura datos base + recurrencia)─┼─► HU-F03 (resumen solo lectura, usa C3 + C4)
                                          │
HU-F02 (kickoff, depende de F01) ─────────┘

HU-F03 → HU-F06 (dashboard, usa C3 + C2 readOnly)
HU-F01 + HU-F08 comparten C1 (AlertaBadge)
HU-F03 + HU-F06 + HU-F08 comparten C2 (CSATIndicator)
HU-F05 + HU-F07 comparten C5 (vista de reportes con tabs)
HU-F06 reutiliza el formulario de HU-F04 para "Ampliar proyecto" (C6)
```
Recomendación de secuencia de implementación en Cursor: **F04 → F01 → F02 → F03 → F06 → F08 → F05 → F07**, para que cada componente compartido ya exista cuando la siguiente HU lo necesite.

---

## PROMPT 1 — HU-F01: Bandeja de soporte comercial (Validar venta antes de PMO)

```
Actúa como ingeniero frontend senior trabajando en Cursor sobre el proyecto CRM Frisson. Vas a construir la pantalla de la HU-F01 usando SPEC-DRIVEN DEVELOPMENT: primero especificas, luego diseñas, luego planificas tareas, y solo al final implementas código. No saltes fases.

CONTEXTO VISUAL A CONSERVAR (no modificar sidebar/topbar/patrones existentes):
[pegar aquí el bloque "DESIGN SYSTEM ACTUAL - FRISSON CRM"]
Esta pantalla debe sentirse como una extensión natural del módulo "Oportunidades (OUV)" ya existente (mismo patrón de tabs + filtros + tabla que ves en "Bandeja OUV").

REGLA DE NO DUPLICACIÓN (obligatoria):
- El "alerta hacia el KAM" debe implementarse usando un componente genérico `AlertaBadge`/`AlertaBanner` (tipo + estado + descripción + fecha), pensado para ser reutilizado también por HU-F08. No lo construyas como un elemento ad-hoc de esta pantalla; sepáralo como componente independiente y documenta su props/interfaz.
- Los datos capturados aquí (empresa ejecutora Frisson/Verytel/UT, listado de UT, % de participación) forman parte de un modelo compartido `DatosBaseProyecto` que también alimentará HU-F04 y se mostrará de solo lectura en HU-F03. Modélalo como tal desde el inicio (no como estado local aislado del componente).

FASE 1 - REQUIREMENTS (genera docs/specs/HU-F01/requirements.md):
Formaliza como historia: "Como profesional de soporte comercial, quiero recibir en una bandeja las ventas marcadas como ganadas y validar su documentación, aceptación y coherencia contractual, para controlar que únicamente las ventas verificadas continúen hacia PMO."
Convierte cada criterio de aceptación en formato Given/When/Then:
- Dada una oportunidad marcada como ganada, cuando finaliza el cierre comercial, entonces se ubica en la bandeja de soporte comercial y NO se crea todavía en Control de Proyectos.
- El sistema debe permitir identificar el tipo de venta con 2 opciones: Licitación o Venta directa.
- La bandeja muestra como mínimo: oportunidad, cliente, vendedor, estado de revisión y resultado de validaciones documental, técnica, financiera y contractual.
- Si alguna validación está pendiente o rechazada, el envío a PMO permanece bloqueado y se indica el motivo (alerta visible hacia el KAM usando el componente `AlertaBadge` compartido).
- Si todas las validaciones están aprobadas, se habilita el paso de kickoff, pero el envío sigue siendo manual (no automático).
- Se conserva usuario, fecha, resultado y observación de cada interacción de validación.
- La OUV queda asignada al profesional de soporte comercial hasta que la revise y avale su paso a creación de proyecto.
- Desde el inicio del ciclo de vida de la OUV se debe capturar la empresa ejecutora (Frisson, Verytel y/o UT), el listado de Uniones Temporales, y el % de participación por empresa (parte del modelo `DatosBaseProyecto`).

FASE 2 - DESIGN (genera docs/specs/HU-F01/design.md):
- Define el nuevo tab "Bandeja Soporte Comercial" dentro del módulo Oportunidades (OUV), reutilizando el layout de tabs existente.
- Diseña el componente de tabla (columnas: Consecutivo OUV, Título/Empresa, Vendedor, Tipo de venta [Licitación/Venta directa], Estado de revisión, Validaciones [4 badges: Documental/Técnica/Financiera/Contractual], Resultado global, Fecha).
- Diseña el panel/drawer de detalle al hacer click en un registro: sección de validaciones con estado (Pendiente/Aprobado/Rechazado) + campo de observación por validación, sección "Empresa ejecutora" (selector múltiple Frisson/Verytel/UT + tabla de Uniones Temporales con % de participación, validando que la suma sea 100%, todo dentro del modelo `DatosBaseProyecto`), badge de alerta hacia el KAM (`AlertaBadge`) cuando haya rechazo/pendiente, botón "Enviar a Kickoff" deshabilitado hasta cumplir condiciones.
- Especifica el contrato/interfaz TypeScript de `AlertaBadge` y de `DatosBaseProyecto` en este documento, ya que serán importados por otras HU (F08 y F03/F04 respectivamente).
- Define los estados vacíos, de carga y de error de la bandeja.
- No implementes lógica de backend real: usa datos mock/servicios stub tipados (TypeScript interfaces) para poder conectar después.

FASE 3 - TASKS (genera docs/specs/HU-F01/tasks.md):
Descompón en tareas atómicas trazables a cada criterio de aceptación (ej. T1: componente de tabla, T2: badges de validación, T3: drawer de detalle, T4: bloque empresa ejecutora/UT con validación de % usando `DatosBaseProyecto`, T5: componente compartido `AlertaBadge`, T6: lógica de habilitación del botón de envío, T7: mocks de datos).

FASE 4 - IMPLEMENTACIÓN:
Ejecuta las tareas de tasks.md en orden, generando componentes reutilizables y consistentes con el design system. Al terminar, verifica cada criterio de aceptación contra la UI implementada y repórtalo como checklist.
```

---

## PROMPT 2 — HU-F02: Panel de Kickoff (condición de envío)

```
Actúa como ingeniero frontend senior en Cursor, proyecto CRM Frisson. Construye la HU-F02 con SPEC-DRIVEN DEVELOPMENT (requirements → design → tasks → implementación), sin saltar fases.

CONTEXTO VISUAL A CONSERVAR:
[pegar aquí el bloque "DESIGN SYSTEM ACTUAL - FRISSON CRM"]
Este panel se abre desde el detalle de un registro ya aprobado en la Bandeja de Soporte Comercial (HU-F01), como una sección o sub-tab "Kickoff" dentro del mismo detalle. Depende directamente de HU-F01 (no dupliques su bandeja ni su drawer; este panel se agrega dentro del mismo detalle ya construido).

FASE 1 - REQUIREMENTS (docs/specs/HU-F02/requirements.md):
Historia: "Como profesional de soporte comercial, quiero registrar y verificar la realización del kickoff de entrega, para evitar que un proyecto llegue a PMO sin la sesión de transferencia y sus aprobaciones."
Criterios en Given/When/Then:
- Se puede asociar al registro la sesión de kickoff y consultar su estado (Programado/Realizado/Cancelado).
- Mientras el kickoff no figure como realizado, el botón "Creación de Proyecto" permanece deshabilitado (visualmente en estado disabled con tooltip explicativo).
- Si la sesión fue cancelada o no cumple la validación definida, no se permite enviar el proyecto y se muestra una explicación visible (mensaje de bloqueo).
- Validación opcional contra Teams: mostrar un indicador "Validado por Teams" / "Pendiente de validación" (dejar como estado mock, ya que la fuente de asistencia/quórum aún no está definida).
- Cuando el kickoff esté realizado y las aprobaciones completas, se habilita el envío a PMO (botón "Creación de Proyecto" activo en naranja).
- Se registra y muestra la fecha de realización del kickoff.

FASE 2 - DESIGN (docs/specs/HU-F02/design.md):
- Componente "Tarjeta de Kickoff" con: selector/asociación de sesión (nombre, fecha, enlace), badge de estado (Programado=azul, Realizado=verde, Cancelado=rojo/gris), checklist de aprobaciones requeridas, indicador opcional de validación Teams.
- Estado del botón "Creación de Proyecto" gobernado por una función pura `puedeEnviarAPMO(kickoff, aprobaciones)` para que quede claro y testeable en UI (mock).
- Mensajes de bloqueo contextuales (banner naranja/rojo) explicando la causa exacta; si el disparador es equivalente a un caso de alerta, reutiliza el mismo estilo visual del componente `AlertaBadge` definido en HU-F01 en vez de crear un banner nuevo desde cero.

FASE 3 - TASKS (docs/specs/HU-F02/tasks.md):
Tareas atómicas: T1 tarjeta de kickoff y badges de estado, T2 checklist de aprobaciones, T3 lógica de habilitación del botón con estados mock, T4 indicador opcional de validación Teams, T5 banner de bloqueo reutilizando estilo de `AlertaBadge`.

FASE 4 - IMPLEMENTACIÓN:
Implementa siguiendo tasks.md, reutilizando componentes de badges/botones ya definidos en el design system y el componente `AlertaBadge` de HU-F01. Verifica cada criterio de aceptación al final con un checklist explícito.
```

---

## PROMPT 3 — HU-F03: Resumen y confirmación de envío del proyecto a PMO

```
Actúa como ingeniero frontend senior en Cursor, proyecto CRM Frisson. Implementa la HU-F03 siguiendo SPEC-DRIVEN DEVELOPMENT (requirements → design → tasks → implementación).

CONTEXTO VISUAL A CONSERVAR:
[pegar aquí el bloque "DESIGN SYSTEM ACTUAL - FRISSON CRM"]
Este flujo se dispara al presionar el botón "Creación de Proyecto" habilitado en HU-F02; abre un modal/resumen final de confirmación.

REGLA DE NO DUPLICACIÓN (obligatoria — esta HU es una vista de confirmación, NO un formulario nuevo):
- Los campos "Valor total del contrato", "Tipo de proyecto (recurrente/no recurrente)", "Fecha inicio", "Participación" y "% de participación" NO se capturan aquí: se leen en modo solo lectura desde el modelo compartido `DatosBaseProyecto` (capturado en HU-F01 y HU-F04). No repliques selectores ni inputs editables para estos campos.
- Los campos "Costos", "Tiempo", "Ejecución", "Alcance" y "Facturación proyectada" se leen del modelo compartido `IndicadoresProyecto`, el mismo que usará HU-F06 en su dashboard. Defínelo aquí como interfaz compartida (o reutilízala si ya existe de HU-F06) en vez de crear un tipo local distinto.
- El campo "CSAT" se muestra usando el componente compartido `CSATIndicator` en modo `readOnly` (el mismo componente que HU-F06 usa en solo lectura y HU-F08 usa en modo edición). No crees un indicador de satisfacción nuevo.

FASE 1 - REQUIREMENTS (docs/specs/HU-F03/requirements.md):
Historia: "Como profesional de soporte comercial, quiero revisar un resumen final y confirmar el envío del proyecto a Control de Proyectos, para crear el proyecto con información validada y reducir la redigitación en PMO."
Criterios Given/When/Then:
- Antes de confirmar, el sistema presenta un resumen de los datos obligatorios que serán enviados (leídos de `DatosBaseProyecto` e `IndicadoresProyecto`, no recapturados).
- Si falta un dato obligatorio, se identifica el campo puntual y se bloquea el avance.
- Se muestra un % de avance del checklist (barra de progreso) que indica qué falta para convertir la OUV en proyecto.
- Se listan las fuentes de información generadas por proyecto y se retornan visibles en la vista del CRM.
- Cuando Control de Proyectos "acepta" (simulado), el registro cambia a estado "Enviado" y se muestra el consecutivo retornado (mock).
- Si el envío "falla" (simulado), el registro conserva la información capturada y muestra el motivo, permitiendo reintento controlado.
- El resumen debe incluir explícitamente los campos: Valor total del contrato, Tipo de proyecto (recurrente-no recurrente), Facturación proyectada, Estado, Fecha inicio, Fecha cambio de estado, Costos, Tiempo, Ejecución, Alcance, Participación, % de participación, UBV, CSAT, Centro de costos — todos en modo solo lectura desde los modelos compartidos.

FASE 2 - DESIGN (docs/specs/HU-F03/design.md):
- Modal "Resumen de envío a PMO" con: barra de progreso de checklist (%), lista de campos obligatorios con ícono check/alerta, sección de campos leídos de `DatosBaseProyecto`, sección de indicadores leídos de `IndicadoresProyecto`, componente `CSATIndicator` en modo lectura, botón primario "Confirmar envío" (deshabilitado si checklist <100%), botón secundario "Cancelar".
- Estados post-confirmación: Enviado (badge verde + consecutivo), Pendiente (badge naranja), Rechazado (badge rojo + motivo), Error (badge gris + botón "Reintentar").
- Documenta en este archivo la interfaz `IndicadoresProyecto` como fuente única de verdad, ya que HU-F06 la reutilizará; si HU-F06 ya fue implementada primero, importa su definición en vez de recrearla.

FASE 3 - TASKS (docs/specs/HU-F03/tasks.md):
T1 modal de resumen + barra de progreso, T2 validación de campos obligatorios (lectura desde modelos compartidos), T3 sección de indicadores usando `IndicadoresProyecto`, T4 integración de `CSATIndicator` en modo lectura, T5 estados de resultado (enviado/pendiente/rechazado/error) con mock de respuesta, T6 flujo de reintento.

FASE 4 - IMPLEMENTACIÓN:
Implementa en orden, reutilizando badges, botones y modelos compartidos del design system. Cierra con checklist de verificación de cada criterio de aceptación.
```

---

## PROMPT 4 — HU-F04: Formulario de captura de información base del proyecto

```
Actúa como ingeniero frontend senior en Cursor, proyecto CRM Frisson. Construye la HU-F04 con SPEC-DRIVEN DEVELOPMENT (requirements → design → tasks → implementación).

CONTEXTO VISUAL A CONSERVAR:
[pegar aquí el bloque "DESIGN SYSTEM ACTUAL - FRISSON CRM"]
Este formulario se abre desde el flujo de alta (previo al resumen de HU-F03), como un paso de captura/edición dentro del mismo detalle de la oportunidad.

REGLA DE NO DUPLICACIÓN (obligatoria):
- Este formulario captura y **completa** el modelo compartido `DatosBaseProyecto`, iniciado parcialmente en HU-F01 (empresa ejecutora/UT/%). No dupliques esos campos aquí; solo añade nombre, cliente, oportunidad, fechas, valor a facturar, costo estimado y clasificación recurrente/no recurrente al mismo modelo.
- Este mismo formulario (o sus componentes de campo) debe diseñarse pensando en ser **reutilizado en modo edición** por la acción "Ampliar proyecto" de HU-F06. Sepáralo en un componente `FormularioDatosProyecto` independiente que acepte un modo `crear` y un modo `ampliar`.

FASE 1 - REQUIREMENTS (docs/specs/HU-F04/requirements.md):
Historia: "Como profesional de soporte comercial, quiero consultar y completar la información base que será remitida al proyecto, para entregar a PMO los insumos iniciales de ejecución sin reconstruir la venta."
Criterios Given/When/Then:
- El formulario precarga la información disponible en la oportunidad y distingue visualmente los campos editables de los de solo consulta (ej. candado/ícono de solo lectura).
- El primer alcance exige como mínimo: nombre del proyecto, cliente, oportunidad, fecha de inicio, fecha de fin, valor a facturar y costo estimado (marcar como obligatorios).
- Se permite clasificar el proyecto como recurrente o no recurrente (selector tipo switch/radio).
- Al asignar el proyecto a un Director de Proyecto, se dispara una notificación (mock de correo, mostrar un toast/confirmación "Notificación enviada a [Director]").
- (Nota de análisis abierta) El set de indicadores financieros aún no está cerrado con Preventa/Finanzas/PMO: dejar esa sección como bloque extensible/placeholder claramente marcado como "Pendiente de definición".

FASE 2 - DESIGN (docs/specs/HU-F04/design.md):
- Formulario dividido en secciones: "Datos precargados" (solo lectura, con ícono distintivo), "Datos obligatorios del proyecto" (editable, con validación en tiempo real, escribe sobre `DatosBaseProyecto`), "Clasificación" (recurrente/no recurrente), "Responsable" (selector de Director de Proyecto con disparo de notificación mock), "Indicadores financieros" (placeholder extensible, deshabilitado/etiquetado "Pendiente de definición").
- Define el componente como `FormularioDatosProyecto` con prop `modo: 'crear' | 'ampliar'`, documentando explícitamente que HU-F06 lo reutilizará para "Ampliar proyecto" sin crear un formulario paralelo.
- Define validaciones de campo obligatorio con mensajes inline, consistentes con el estilo naranja de alerta del design system.

FASE 3 - TASKS (docs/specs/HU-F04/tasks.md):
T1 estructura de formulario y secciones (`FormularioDatosProyecto`), T2 precarga de datos mock + distinción editable/solo lectura, T3 validaciones de obligatoriedad, T4 selector recurrente/no recurrente, T5 selector de Director de Proyecto + toast de notificación mock, T6 placeholder de indicadores financieros, T7 soporte del modo `ampliar` (mismos campos, prellenados, para ser invocado desde HU-F06).

FASE 4 - IMPLEMENTACIÓN:
Implementa siguiendo tasks.md. Verifica al final cada criterio de aceptación con checklist explícito, señalando qué queda pendiente por la nota de análisis abierta.
```

---

## PROMPT 5 — HU-F05: Trazabilidad de nombre, oportunidad y consecutivos homologados (Reportes)

```
Actúa como ingeniero frontend senior en Cursor, proyecto CRM Frisson. Implementa la HU-F05 con SPEC-DRIVEN DEVELOPMENT (requirements → design → tasks → implementación).

CONTEXTO VISUAL A CONSERVAR:
[pegar aquí el bloque "DESIGN SYSTEM ACTUAL - FRISSON CRM"]

REGLA DE NO DUPLICACIÓN (obligatoria):
- HU-F05 y HU-F07 son **una sola vista de reportes** con dos tabs ("Trazabilidad" y "Ejecución por contexto comercial"), no dos pantallas independientes. Si HU-F07 aún no existe, construye esta vista dejando explícitamente el segundo tab como punto de extensión (`ReporteProyectosView` con tabs internos); si HU-F07 ya existe, agrega el tab a la vista existente en vez de crear una nueva.
- Ambas HU comparten el mismo componente de tabla base y el mismo data source de "proyectos"; solo cambian las columnas visibles y los filtros aplicados por tab.

FASE 1 - REQUIREMENTS (docs/specs/HU-F05/requirements.md):
Historia: "Como usuario de soporte comercial, quiero visualizar el nombre homologado y los identificadores de la oportunidad y del proyecto, para seguir el mismo negocio entre CRM y Control de Proyectos sin confundir registros."
Criterios Given/When/Then:
- Cada registro muestra el identificador único de oportunidad (CRM) y el nombre homologado del proyecto, lado a lado.
- Cuando Control de Proyectos genera un consecutivo, éste se muestra junto al identificador comercial (nunca lo reemplaza).
- Un mismo identificador de oportunidad no debe generar más de un proyecto por reintentos (mostrar visualmente si existiera una alerta de duplicidad, reutilizando el componente `AlertaBadge` si aplica el mismo patrón visual).

FASE 2 - DESIGN (docs/specs/HU-F05/design.md):
- Define `ReporteProyectosView` con tabs "Trazabilidad" (este tab) y "Ejecución por contexto comercial" (reservado para HU-F07).
- Tab "Trazabilidad": tabla con columnas ID Oportunidad (CRM), Nombre homologado del proyecto, Consecutivo Control de Proyectos, Cliente, Fecha de homologación/creación, indicador de "posible duplicado".
- Filtros: por ID de oportunidad, por nombre/cliente, por rango de fechas (reutilizar componente de filtros existente del design system).
- Vista de detalle al hacer click: línea de tiempo simple mostrando "Oportunidad creada → Enviada a PMO → Consecutivo asignado".

FASE 3 - TASKS (docs/specs/HU-F05/tasks.md):
T1 shell de `ReporteProyectosView` con tabs (dejando el tab de HU-F07 como placeholder si aún no se ha implementado), T2 tabla de trazabilidad con datos mock, T3 filtros reutilizados, T4 badge de alerta de duplicidad, T5 vista de detalle con línea de tiempo.

FASE 4 - IMPLEMENTACIÓN:
Implementa en orden y verifica cada criterio de aceptación con checklist al final.
```

---

## PROMPT 6 — HU-F06: Dashboard de desempeño integral del proyecto

```
Actúa como ingeniero frontend senior en Cursor, proyecto CRM Frisson. Implementa la HU-F06 con SPEC-DRIVEN DEVELOPMENT (requirements → design → tasks → implementación).

CONTEXTO VISUAL A CONSERVAR:
[pegar aquí el bloque "DESIGN SYSTEM ACTUAL - FRISSON CRM"]
Este es un dashboard nuevo, ubicado probablemente en el módulo "Implementación (SER)" o como sub-tab "Desempeño" dentro del detalle de un proyecto ya creado.

REGLA DE NO DUPLICACIÓN (obligatoria):
- Los 5 bloques de indicadores (Facturación, Costos, Tiempo, Alcance, Documentación) deben leerse del mismo modelo compartido `IndicadoresProyecto` usado por HU-F03. Si HU-F03 ya definió esta interfaz, impórtala; si no existe aún, defínela aquí de forma que HU-F03 la reutilice después.
- El bloque de satisfacción del cliente debe usar el componente compartido `CSATIndicator` en modo `readOnly` (el mismo que usa HU-F03 en lectura y HU-F08 en edición). No crees un indicador nuevo.
- El botón "Ampliar proyecto" debe abrir el componente `FormularioDatosProyecto` (definido en HU-F04) en modo `ampliar`, prellenado con los datos actuales del proyecto. No construyas un formulario nuevo para esta acción.

FASE 1 - REQUIREMENTS (docs/specs/HU-F06/requirements.md):
Historia: "Como KAM y líder comercial, quiero consultar el estado de facturación, costos, tiempo, alcance y documentación, para tener una lectura integral del proyecto desde el CRM."
Criterios Given/When/Then:
- La vista agrupa los indicadores en 5 bloques: Facturación, Costos, Tiempo, Alcance, Documentación (desde `IndicadoresProyecto`).
- Cada indicador muestra su valor/estado recibido y su fecha de actualización.
- Se muestra un acumulado consolidado de las fuentes de datos de TODOS los proyectos, adicionalmente conectado (visualmente) con las fuentes de datos de CERES.
- Los cálculos cuya fuente es Control de Proyectos NO son editables desde CRM (mostrar como solo lectura/bloqueado).
- Cuando un indicador no aplique o no tenga datos, se muestra "Sin dato disponible" en vez de un cero no confirmado.
- Se refleja una línea de tiempo/trazabilidad de los estados históricos del proyecto (extraída de Control de Proyectos).
- La funcionalidad de "Ampliación del proyecto" debe estar disponible desde el CRM (ya no existe en Control de Proyectos): botón "Ampliar proyecto" que abre `FormularioDatosProyecto` en modo `ampliar`.

FASE 2 - DESIGN (docs/specs/HU-F06/design.md):
- Layout tipo dashboard con 5 tarjetas/paneles (Facturación, Costos, Tiempo, Alcance, Documentación), cada una con valor destacado, badge de estado y "Actualizado: [fecha]", todas alimentadas por `IndicadoresProyecto`.
- Bloque de satisfacción del cliente usando `CSATIndicator` en modo lectura.
- Bloque superior de "Acumulado global" (todos los proyectos) con conexión visual a CERES (etiqueta "Fuente: CERES").
- Componente de línea de tiempo horizontal/vertical de estados históricos del proyecto.
- Botón "Ampliar proyecto" visible en el header del dashboard, invocando `FormularioDatosProyecto` en modo `ampliar` (de HU-F04).
- Marcar explícitamente en la UI los campos de solo lectura (ícono de candado + tooltip "Calculado por Control de Proyectos").

FASE 3 - TASKS (docs/specs/HU-F06/tasks.md):
T1 layout de 5 tarjetas de indicadores usando `IndicadoresProyecto` mock, T2 integración de `CSATIndicator` en modo lectura, T3 bloque de acumulado global/CERES, T4 estado "Sin dato disponible", T5 línea de tiempo de estados, T6 botón "Ampliar proyecto" invocando `FormularioDatosProyecto` en modo `ampliar`, T7 marcado de solo lectura.

FASE 4 - IMPLEMENTACIÓN:
Implementa en orden y cierra con checklist de verificación de cada criterio.
```

---

## PROMPT 7 — HU-F07: Filtro de ejecución por contexto comercial (Reportes)

```
Actúa como ingeniero frontend senior en Cursor, proyecto CRM Frisson. Implementa la HU-F07 con SPEC-DRIVEN DEVELOPMENT (requirements → design → tasks → implementación).

CONTEXTO VISUAL A CONSERVAR:
[pegar aquí el bloque "DESIGN SYSTEM ACTUAL - FRISSON CRM"]

REGLA DE NO DUPLICACIÓN (obligatoria):
- Esta HU **no crea una pantalla nueva**: agrega el tab "Ejecución por contexto comercial" a la vista `ReporteProyectosView` ya definida/iniciada en HU-F05. Reutiliza el mismo componente de tabla base y el mismo data source de proyectos; si HU-F05 no ha sido implementada aún, deja el tab de "Trazabilidad" como placeholder para no duplicar el shell de la vista.

FASE 1 - REQUIREMENTS (docs/specs/HU-F07/requirements.md):
Historia: "Como líder de comercial, quiero filtrar los proyectos por oportunidad, cliente y vendedor, para analizar la ejecución desde el contexto comercial que originó cada proyecto."
Criterios Given/When/Then:
- El listado permite filtrar por oportunidad, cliente y vendedor.
- Los filtros pueden combinarse y solo muestran proyectos relacionados con la combinación aplicada.
- Al seleccionar un resultado, se accede al resumen del proyecto (dashboard HU-F06) y a la oportunidad de origen.
- Los vendedores ven únicamente los registros permitidos por su perfil (rol); los roles transversales ven el alcance autorizado (mock de permisos por rol).
- Los filtros conservan los identificadores de origen aunque cambie el nombre visible del proyecto.

FASE 2 - DESIGN (docs/specs/HU-F07/design.md):
- Agrega el tab "Ejecución por contexto comercial" dentro de `ReporteProyectosView` (definida en HU-F05), reutilizando el componente de tabla base.
- Bloque de filtros (reutilizar componente existente): Oportunidad, Cliente, Vendedor, con opción de combinarlos.
- Columnas propias de este tab: Consecutivo, Nombre del proyecto, Oportunidad de origen (ID), Cliente, Vendedor, Estado, Fecha, con click-through hacia el dashboard de desempeño (HU-F06).
- Lógica de visibilidad simulada por rol (mock: "Vendedor" ve solo lo propio, "Líder Comercial"/rol transversal ve todo); esta lógica de permisos debe quedar aislada en un helper reutilizable, ya que podría aplicar también al tab de Trazabilidad de HU-F05.

FASE 3 - TASKS (docs/specs/HU-F07/tasks.md):
T1 tab "Ejecución por contexto comercial" dentro de `ReporteProyectosView`, T2 filtros combinables, T3 columnas propias sobre la tabla base compartida, T4 navegación al detalle/dashboard (HU-F06), T5 helper de visibilidad por rol (mock, reutilizable).

FASE 4 - IMPLEMENTACIÓN:
Implementa en orden y verifica cada criterio de aceptación con checklist final.
```

---

## PROMPT 8 — HU-F08: Alertas e índice de satisfacción del cliente (CSAT)

```
Actúa como ingeniero frontend senior en Cursor, proyecto CRM Frisson. Implementa la HU-F08 con SPEC-DRIVEN DEVELOPMENT (requirements → design → tasks → implementación).

CONTEXTO VISUAL A CONSERVAR:
[pegar aquí el bloque "DESIGN SYSTEM ACTUAL - FRISSON CRM"]
Este panel se integra dentro del dashboard de desempeño (HU-F06) o como sub-tab "Satisfacción y alertas" del detalle del proyecto.

REGLA DE NO DUPLICACIÓN (obligatoria):
- Las "alertas operativas" de esta HU deben renderizarse con el mismo componente `AlertaBadge` definido en HU-F01. No crees un componente de alerta nuevo; si HU-F01 aún no se ha implementado, defínelo aquí dejando explícito que HU-F01 lo reutilizará.
- La captura/edición del CSAT debe hacerse sobre el mismo componente `CSATIndicator` usado en modo lectura por HU-F03 y HU-F06. Aquí se habilita su modo `editable`, controlado por rol (Gestor de Mercadeo / Director de Mercadeo). No crees un formulario de puntuación paralelo.

FASE 1 - REQUIREMENTS (docs/specs/HU-F08/requirements.md):
Historia: "Como usuario de seguimiento comercial, quiero visualizar alertas del proyecto y el resultado de satisfacción del cliente cuando exista, para identificar condiciones que requieren seguimiento después de la venta."
Criterios Given/When/Then:
- Cuando la fuente informa una alerta o bloqueo, se presenta de forma visible con tipo, estado y descripción (usando `AlertaBadge`).
- Cuando exista medición CSAT, se muestra su valor, escala y fecha de medición (usando `CSATIndicator` en modo lectura para roles sin permiso de edición).
- Si no existe medición de satisfacción, se indica "Sin medición disponible".
- El CRM no genera por sí mismo alertas cuyos umbrales no hayan sido definidos (no inventar alertas sin fuente/regla).
- Los roles "Gestor de Mercadeo" y "Director de Mercadeo" pueden diligenciar/puntuar el índice de satisfacción del cliente directamente desde el CRM (`CSATIndicator` en modo `editable`); esa información viaja hacia Control de Proyectos (mock) y debe reflejarse también donde este mismo componente se usa en modo lectura (HU-F03, HU-F06).

FASE 2 - DESIGN (docs/specs/HU-F08/design.md):
- Sección "Alertas operativas": lista usando `AlertaBadge` (tipo, estado, descripción), diferenciada visualmente de la sección de satisfacción.
- Sección "Índice de satisfacción (CSAT)": instancia de `CSATIndicator`; en modo lectura si el usuario no tiene permiso, en modo edición (selector de escala, fecha, botón "Guardar puntuación") si el rol es Gestor/Director de Mercadeo.
- Control de acceso por rol (mock) que determina el modo del componente `CSATIndicator`.
- Diferenciar claramente alerta vs. indicador de satisfacción (iconografía y color distintos, siguiendo la paleta del design system).

FASE 3 - TASKS (docs/specs/HU-F08/tasks.md):
T1 sección de alertas operativas usando `AlertaBadge` con datos mock, T2 integración de `CSATIndicator` con soporte de ambos modos, T3 control de acceso por rol (mock) que determina el modo, T4 formulario de captura de CSAT (modo editable) y confirmación de envío simulado.

FASE 4 - IMPLEMENTACIÓN:
Implementa en orden y cierra con checklist de verificación de cada criterio de aceptación.
```

---

## Notas de uso
- Antes de pegar cada prompt en Cursor, reemplaza `[pegar aquí el bloque "DESIGN SYSTEM ACTUAL - FRISSON CRM"]` por el bloque completo de la sección "Design System de referencia".
- Sigue la **secuencia recomendada de implementación** (F04 → F01 → F02 → F03 → F06 → F08 → F05 → F07) para que cada componente/modelo compartido (`AlertaBadge`, `CSATIndicator`, `IndicadoresProyecto`, `DatosBaseProyecto`, `FormularioDatosProyecto`, `ReporteProyectosView`) ya exista cuando la siguiente HU lo necesite. Si decides ejecutar los prompts en otro orden, cada prompt ya incluye la instrucción de "definir aquí si no existe, e importar si ya existe" para no bloquear el desarrollo.
- Todas las HU quedan restringidas a capa visual/frontend (mocks, sin lógica real de integración) y **dentro de un mismo módulo del CRM**, consistente con que las HU backend (HU-B01 a HU-B06) no aplican para este ejercicio.
- Cada prompt exige que Cursor **primero genere los documentos de spec** (requirements/design/tasks) antes de tocar código, para permitir validación previa a la implementación.
