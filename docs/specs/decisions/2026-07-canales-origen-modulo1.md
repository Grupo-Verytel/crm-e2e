# Propuesta: canales de origen en Generación de Demanda (Módulo 1)

**Autor:** Claude (para Evilio Díaz) · **Fecha:** 16 julio 2026
**Spec base:** `spec-demand-generation.md` v2.0 · **Blueprint:** Frisson CRM Blueprint V2

---

## 1. Diagnóstico del funcionamiento actual

El spec v2.0 y el Blueprint V2 modelan un **único embudo homogéneo**:

- Todo lead nace en estado `Nuevo → TOFU`.
- Las transiciones son numéricas: `lead_score ≥ 30` (TOFU→MOFU), `lead_score ≥ 60 + icp_score ≥ 40` (MOFU→MQL_PENDING).
- El Kanban tiene 4 columnas fijas: `TOFU | MOFU | MQL_PENDING | SQL`, iguales para cualquier lead.
- El campo `origen` existe en la tabla de leads (Blueprint pág. 26) pero es **solo informativo** — no gobierna navegación ni estados.

Los 5 canales que describes exigen tres cosas que el modelo actual no soporta:

| Necesidad | Canal(es) | Por qué rompe el modelo actual |
|---|---|---|
| Estado de entrada distinto a TOFU | Generación de Demanda (agencia) | Nace en MOFU: la agencia ya hizo la prospección/contacto inicial |
| Salto de un estado intermedio | Fábricas | TOFU→BOFU sin pasar por MOFU |
| Transición por evento manual, no por score | Generación de Demanda (agencia) | El paso MOFU→BOFU ocurre cuando "un rol especial" registra que se logró la cita, no por umbral numérico |

**Traductores de Negocio** queda fuera de este análisis porque no tengo definición de su comportamiento de entrada/transición. Antes de tocar spec o código para ese canal necesito que confirmes: ¿en qué estado entra, y qué evento lo mueve de estado?

---

## 2. Propuesta de UX/UI

### 2.1 Elevar "Canal de Origen" a filtro de primer nivel
Hoy `origen` es una columna más en la tabla. Debe convertirse en una **barra de chips de filtro persistente** arriba de ambas vistas (Lista y Kanban):

`Todos · Campañas Digitales · BTL · Fábricas · Gen. Demanda (Agencia) · Traductores de Negocio`

Esto no es cosmético: como cada canal usa un subconjunto distinto de estados, filtrar por canal es la única forma de que el Kanban tenga sentido visual.

### 2.2 Kanban con columnas conscientes del canal
- Con `Todos` seleccionado: se muestran las 4 columnas actuales (superset), pero cada tarjeta lleva un **mini-stepper** (3-4 puntos) que indica su ruta esperada según canal — así se ve de un vistazo que una tarjeta de Fábricas "no va a pasar" por MOFU, en vez de parecer una tarjeta perdida.
- Con un canal específico filtrado: las columnas que ese canal no usa se colapsan a una franja delgada con la etiqueta "no aplica para este canal" en vez de desaparecer (mantiene el contexto espacial del embudo completo sin ocupar espacio).

### 2.3 Bandeja de Agenda (nueva, solo para Gen. Demanda/Agencia)
El paso "cita agendada por rol especial" es un evento humano, no automático — necesita su propia superficie de trabajo, igual que hoy existe "Bandeja SQL" para el comercial:

- Nueva pantalla/tab: **Bandeja de Agenda** — lista de leads en MOFU con `canal_origen = GENERACION_DEMANDA_AGENCIA`.
- Acción única: **Registrar Cita Agendada** → pide `fecha_cita` + `comercial_asignado` (obligatorios) → dispara transición MOFU→BOFU y notifica al comercial asignado.
- **Confirmado:** esta bandeja es del rol "Profesional Soporte Comercial" que ya está en el actor list del Blueprint (asigna leads, ya tiene esa responsabilidad) — no se crea rol nuevo.

### 2.4 Lead/Detalle: "Ruta esperada" dinámica
En vez de asumir que todo lead pasa por las 4 etapas, el detalle del lead debe mostrar un breadcrumb calculado a partir de `canal_origen`, con los estados no aplicables tachados/atenuados. Esto evita que un comercial se pregunte "¿por qué este lead de Fábricas nunca pasó por MOFU?".

### 2.5 Filtros existentes se mantienen
Reciclaje/Descartado siguen como filtro aparte (según decisión ya tomada), simplemente ahora se pueden combinar con el filtro de canal para triage más fino.

---

## 3. Delta de spec propuesto (`spec-demand-generation.md` → v2.1)

### 3.1 Nuevo campo en entidad Lead
```
canal_origen: enum [
  CAMPANA_DIGITAL,
  BTL,
  FABRICA,
  GENERACION_DEMANDA_AGENCIA,
  TRADUCTOR_NEGOCIO   // pendiente de definición de comportamiento
] — requerido en creación, inmutable tras creación
```

### 3.2 Nuevos campos (solo aplican a `GENERACION_DEMANDA_AGENCIA`)
```
cita_agendada: boolean, default false
fecha_cita: date, nullable
comercial_asignado_id: FK usuario, nullable
```

### 3.3 Tabla de reglas de flujo por canal (nueva sección del spec)
| canal_origen | estado_entrada | estados_aplicables (orden) | transición especial |
|---|---|---|---|
| CAMPANA_DIGITAL | TOFU | TOFU→MOFU→BOFU→SQL | ninguna (score estándar) |
| BTL | TOFU | TOFU→MOFU→BOFU→SQL | ninguna (score estándar) |
| FABRICA | TOFU | TOFU→BOFU→SQL | **salta MOFU** |
| GENERACION_DEMANDA_AGENCIA | MOFU | MOFU→BOFU→SQL | MOFU→BOFU por **evento manual** (`cita_agendada=true`), no por score |
| TRADUCTOR_NEGOCIO | *pendiente* | *pendiente* | *pendiente* |

### 3.4 Nuevos criterios EARS (borrador, a validar contigo)
```
EARS-19: CUANDO se crea un lead con canal_origen = FABRICA,
  el sistema DEBERÁ asignar estado_inicial = TOFU y omitir la
  transición a MOFU, habilitando la transición directa TOFU → BOFU
  cuando lead_score ≥ 60 + icp_score ≥ 40.

EARS-20: CUANDO se crea un lead con canal_origen =
  GENERACION_DEMANDA_AGENCIA, el sistema DEBERÁ asignar
  estado_inicial = MOFU (sin pasar por TOFU).

EARS-21: CUANDO un usuario con rol Profesional Soporte Comercial
  registra cita_agendada = true sobre un lead en MOFU con
  canal_origen = GENERACION_DEMANDA_AGENCIA, el sistema DEBERÁ
  transicionar el lead a estado BOFU/MQL_PENDING y notificar al
  comercial_asignado_id, independientemente del lead_score.

EARS-22: SI un lead tiene canal_origen = FABRICA o
  GENERACION_DEMANDA_AGENCIA, ENTONCES el Kanban DEBERÁ ocultar o
  atenuar visualmente las columnas no aplicables según la tabla de
  reglas de flujo por canal.

EARS-23: CUANDO se filtra el Kanban o la Lista por un canal_origen
  específico, el sistema DEBERÁ mostrar únicamente los leads de
  ese canal y ajustar las columnas visibles a su ruta de estados.
```

### 3.5 Pendiente antes de cerrar v2.1
- **Definición completa de `TRADUCTOR_NEGOCIO`** (estado de entrada, evento de transición, si requiere aprobación manual como el canal de agencia). Sigue **abierto** — no se implementa su lógica de flujo hasta tenerlo.
- ~~Confirmar rol especial del canal de agencia~~ → **Confirmado: Profesional Soporte Comercial** (rol existente, sin crear uno nuevo).

---

## 4. Prompt para Cursor

```
Contexto: estamos extendiendo el Módulo 1 (Generación de Demanda) del
CRM Frisson para soportar múltiples canales de origen de leads, cada
uno con su propia ruta de estados dentro del embudo TOFU/MOFU/BOFU/SQL.
Este es un cambio de spec antes que de código — sigue SDD.

Spec de referencia: crm-e2e/specs/spec-demand-generation.md (v2.0)

PASO 1 — Actualizar el spec (no escribas código todavía):
1. Agrega el campo `canal_origen` (enum: CAMPANA_DIGITAL, BTL, FABRICA,
   GENERACION_DEMANDA_AGENCIA, TRADUCTOR_NEGOCIO) a la entidad Lead.
2. Agrega los campos `cita_agendada` (boolean), `fecha_cita` (date
   nullable), `comercial_asignado_id` (FK nullable) — solo relevantes
   para canal_origen = GENERACION_DEMANDA_AGENCIA.
3. Agrega la tabla "Reglas de flujo por canal" documentando
   estado_entrada y estados_aplicables por canal_origen (ver tabla
   en propuesta-canales-origen-modulo1.md sección 3.3). Marca
   TRADUCTOR_NEGOCIO como TBD explícitamente, no inventes su
   comportamiento.
4. Agrega los criterios EARS-19 a EARS-23 (ver sección 3.4 del
   documento adjunto) al spec, ajustando numeración si ya existen
   criterios con esos IDs.
5. Muéstrame el diff del spec antes de tocar ningún archivo de
   backend/frontend. Espera mi aprobación.

PASO 2 (solo tras aprobación del spec) — Backend, en este orden
(Models → migration → DTOs → services → controllers, según
.cursor/rules):
1. Migration: agregar canal_origen (enum NOT NULL), cita_agendada
   (boolean default false), fecha_cita (nullable), 
   comercial_asignado_id (FK nullable) a la tabla leads.
2. Actualizar LeadModel (Sequelize) con los nuevos campos y su
   validación de enum.
3. Actualizar CreateLeadDTO para requerir canal_origen y aplicar
   class-validator (usa el skill dto-validation-class-validator).
4. Implementar en el servicio de leads la función
   `resolveEstadoInicial(canal_origen)` que retorna TOFU o MOFU
   según la tabla de reglas de flujo.
5. Implementar `registrarCitaAgendada(leadId, fecha_cita,
   comercial_asignado_id)` que valida canal_origen =
   GENERACION_DEMANDA_AGENCIA y estado actual = MOFU, transiciona a
   BOFU/MQL_PENDING, y registra en auditoría (usa el skill
   registrar-auditoria).
6. Nuevo endpoint: POST /api/v1/leads/{id}/registrar-cita — body
   {fecha_cita, comercial_asignado_id}, rol permitido: Profesional
   Soporte Comercial (confirmado, es el rol existente en el actor
   list del Blueprint — no crear rol nuevo). Retorna el lead
   actualizado o 400/404/409 según corresponda.
7. Ajustar la lógica de transición TOFU→MOFU existente para que se
   omita cuando canal_origen = FABRICA (salta directo a evaluación
   BOFU con las mismas reglas de score que ya existen).

PASO 3 — Frontend:
1. Formulario de creación de lead: agregar selector canal_origen
   (obligatorio). Usa design-system-frisson para los estilos.
2. Barra de filtros (Lista y Kanban): agregar chips de canal_origen
   sobre el filtro existente de estado/segmento. Usa el patrón
   draft/applied ya existente en el módulo (ver LeadsTableView).
3. Vista Kanban: al filtrar por un canal_origen específico, ocultar
   o atenuar (opacity + label "no aplica") las columnas que ese
   canal no usa, según la tabla de reglas de flujo. Con filtro
   "Todos" mostrar las 4 columnas normalmente.
4. Nueva pantalla "Bandeja de Agenda": tabla filtrable (usa
   tabla-filtrable-paginada) con leads en MOFU y canal_origen =
   GENERACION_DEMANDA_AGENCIA. Columnas: nombre, empresa, días en
   MOFU, responsable. Acción por fila: "Registrar Cita Agendada"
   (modal con fecha_cita + selector comercial_asignado_id) que
   llama al nuevo endpoint.
5. Lead/Detalle: agregar componente de breadcrumb "Ruta esperada"
   que se calcula desde canal_origen del lead (no un stepper fijo
   de 4 pasos) — los estados no aplicables se muestran atenuados/
   tachados.

No implementes nada de TRADUCTOR_NEGOCIO más allá del valor de enum
— su lógica de flujo está pendiente de definición de negocio.
```

---

## 5. Antes de que esto vaya a Cursor

Con la confirmación del rol (Profesional Soporte Comercial), solo queda un punto abierto:

1. **Traductores de Negocio**: ¿en qué estado entra un lead de este canal, y qué evento (manual o automático) lo mueve al siguiente estado? ¿Se parece más al flujo de Fábricas (salta MOFU) o al de Generación de Demanda (gate manual)?

Mientras esto siga pendiente, el spec y el prompt de Cursor tratan `TRADUCTOR_NEGOCIO` únicamente como valor de enum, sin lógica de flujo — así el resto de canales (Campañas Digitales, BTL, Fábricas, Gen. Demanda/Agencia) puede avanzar a implementación sin bloquearse por este quinto canal.
