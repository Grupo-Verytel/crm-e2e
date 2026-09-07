# Integración Microsoft Graph

Fachada del CRM sobre Microsoft Graph (app-only / client credentials). Reutiliza
las operaciones del toolkit interno **MicrosoftGraph** (`server.js`) que ya opera
contra el tenant, sin exponer el secreto de Entra ID al navegador.

La consume el agendamiento de Kickoff de Cierre de Oferta
(`frontend/src/modules/offer-closing`).

## Endpoints (`api/v1/graph/*`)

Todos detrás del `JwtAuthGuard` global; no requieren habilidad CASL adicional.

| Método | Ruta | Para qué |
| --- | --- | --- |
| `GET` | `/graph/status` | Diagnóstico: variables faltantes, dominios, roles concedidos, salas. |
| `GET` | `/graph/users?search=&domain=&limit=` | Personas de `frisson.net.co` y `grupoverytel.com`. |
| `POST` | `/graph/availability` | `getSchedule` de personas y/o salas en una ventana. |
| `POST` | `/graph/meetings` | Crea el evento con reunión de Teams e invitaciones. |
| `PATCH` | `/graph/meetings/:eventId` | Reprograma el evento: los invitados reciben una actualizacion, no una cancelacion. |
| `DELETE` | `/graph/meetings/:eventId` | Cancela el evento (avisa a los invitados). |

Las fechas viajan como hora local del tenant (`YYYY-MM-DDTHH:mm`) acompañadas del
`timeZone` (`America/Bogota` por defecto), igual que en el toolkit original.

## Salas

Fijas en `constants/graph.constants.ts`:

| Etiqueta en el CRM | Buzón de recurso |
| --- | --- |
| `Sala Marte` | `sala_marte@grupoverytel.com` |
| `Sala Júpiter` | `sala_jupiter@grupoverytel.com` |

Al crear la reunión, la sala se invita como asistente de tipo `resource` y se usa
como `location` del evento.

## Configuración

Variables en `backend/.env` (ver plantilla `- copia_crm_backend.env`):

```
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
GRAPH_ORG_DOMAINS=frisson.net.co,grupoverytel.com
GRAPH_ORGANIZER_UPN=
GRAPH_TIMEZONE=America/Bogota
```

Permisos de **aplicación** en el app registration de Entra ID, todos con
*Grant admin consent*:

| Permiso | Uso |
| --- | --- |
| `User.Read.All` | Listado de personas por dominio |
| `Calendars.Read` | Disponibilidad de personas y salas (`getSchedule`) |
| `Calendars.ReadWrite` | Crear y cancelar la reunión de Teams |
| `Place.Read.All` | Listado de salas del tenant (opcional) |

`GRAPH_ORGANIZER_UPN` es el buzón organizador **por defecto**: debe tener
licencia de Teams y estar incluido en la *Application Access Policy* de Exchange
Online para esta app. Es opcional — el modal de Kickoff tiene un campo
«Organizador» (con autocompletado del directorio) que se envía como
`organizerUpn` en `/graph/meetings` y `/graph/availability`. Sin ninguno de los
dos, la disponibilidad se consulta buzón por buzón y la creación de la reunión
se rechaza con `400`.

## Notas

- El token se cachea en memoria hasta un minuto antes de expirar; el listado de
  usuarios por dominio se cachea 5 minutos.
- `getSchedule` se intenta primero en una sola llamada desde el buzón organizador
  y, si Exchange la rechaza, cae a una consulta por cada buzón (comportamiento
  del toolkit original para las salas).
- Sin manejo de reintentos ante `429` de Graph.
