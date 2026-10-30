# RESUMEN-PASO-0 — Login APOLO (descubrimiento)

Fecha: 2026-10-30. Solo lectura. No se cambió código de producto ni se creó la rama.

Hay un bloqueo antes del Paso 1. Está en `NOTAS-BLOQUEO-1.md` de esta misma carpeta. El Paso 1 no arranca hasta resolverlo.

## Rama

El working tree está en `EP-FixBug.V11` (`cbdd236`, tracking `origin/EP-FixBug.V11`). No existe checkout de `EP-Feature-LoginApolo`. No se creó: este paso es solo lectura.

Los tres assets nuevos están sin seguimiento de git en este working tree.

## 1. Assets nuevos

Carpeta: `frontend/src/assets/`. Los tres son untracked. Fecha de modificación: 21/10/2026 15:38.

| Rol | Archivo exacto | Tamaño | Qué es |
|---|---|---|---|
| Ilustración de órbita | `Órbita espacial de cuatro etapas.png` | 799 567 bytes | Planeta, avión de papel y cuatro nodos: Prospecta, Califica, Gestiona, Consolida. Fondo negro. |
| Logo para fondo oscuro | `Logotipo APOLO por Frisson sobre negro-1.png` | 425 479 bytes | Marca APOLO por Frisson, texto blanco, placa sobre negro. |
| Logo para fondo claro | `Logotipo APOLO por Frisson-2.png` | 1 035 932 bytes | La misma marca, texto negro, placa sobre blanco. R5: no se usa en esta pantalla. |

Verificado con `git status --short` (los tres aparecen como `??`) y con `LastWriteTime` del filesystem. El nombre de la ilustración lleva tilde en la Ó inicial y los tres nombres llevan espacios.

## 2. Login y slider

No hay un componente de slider aparte. Todo vive en `frontend/src/modules/auth/pages/LoginPage.tsx`, función `LoginPage`. La ruta es `/login` vía `frontend/src/modules/auth/pages/LoginPageLazy.tsx` y `frontend/src/routing/AppRoutes.tsx`.

Las notas están en la constante `LOGIN_SLIDES` del mismo archivo. Son **3**. Ninguna tiene imagen propia.

| Orden | Título | Descripción | Ícono central | Ícono de detalle |
|---|---|---|---|---|
| 1 | Relaciones que crecen | Centraliza cada conversación y construye confianza durante todo el ciclo comercial. | `Handshake` | `Users` |
| 2 | Oportunidades con propósito | Alinea a tu equipo, prioriza mejor y mantén visible el siguiente paso de cada negocio. | `Target` | `Users` |
| 3 | Información que da confianza | Consulta el historial de cada cliente y toma decisiones con datos claros y seguros. | `ShieldCheck` | `Handshake` |

Intervalo: `6000` ms (`window.setInterval` en el `useEffect` de la página). Si el usuario tiene `prefers-reduced-motion: reduce`, el intervalo no arranca y se queda en la nota 0. Hay botones de punto para saltar de nota; el activo mide `w-8`, el resto `w-2`.

Encima del texto hay una composición CSS (tarjeta, círculos, dos íconos lucide) que **cambia con la nota activa**. No es un `<img>` ni un asset por nota.

El panel izquierdo ya se oculta bajo `lg` (`hidden` … `lg:flex`). En móvil no hay logo encima del formulario.

## 3. La ilustración nueva y el centro del slider

El slider no muestra archivos de imagen. Sí muestra, en el centro del panel izquierdo, una escena de íconos que rota con cada nota. La ilustración de órbita ocuparía ese mismo centro y, según el diseño, quedaría fija.

Quitar esa escena, o dejarla junto a la órbita, no está decidido aquí. Detalle y pregunta en `NOTAS-BLOQUEO-1.md`.

## 4. Tokens que ya sirven

Naranja de marca, ya mapeado a `text-accent`, `bg-accent`, `border-accent` en `frontend/tailwind.config.js`:

| Token | Dónde | Valor |
|---|---|---|
| `--accent` | `frontend/src/styles/tokens.css` (`:root`) | `#C25E00` (fallback) |
| `--accent` | `frontend/src/styles/global.css`, tema claro y `:root` sin `data-theme='dark'` | `#f88702` |
| `--accent` | `global.css`, `html[data-theme='dark']` | `#c25e00` |
| `--accent-700` | mismo corte de tema | mezcla del accent al 80 % con negro |

El login no fija el tema. `ThemeProvider` escribe `data-theme` en `<html>` según la preferencia guardada. En claro el naranja visible es `#f88702`; en oscuro, `#c25e00`. El botón actual (`.btn-glow`) y el texto «Bienvenido de nuevo» ya usan ese accent.

Fondos oscuros del login, ya mapeados a `bg-login-left` y `bg-login-right`:

| Token | Valor | Uso actual |
|---|---|---|
| `--login-panel-left` | `#333333` | Panel izquierdo y fondo de los inputs |
| `--login-panel-right` | `#1C1C1C` | Panel del formulario |

No hace falta un token naranja nuevo para cumplir R3: `--accent` ya es el naranja de marca. Los dos fondos del login también existen y ya son tonos distintos. No se propone tocar los tokens Verytel.

Gris de UI disponible: `--text-muted` (`#8A8D98` en `:root`; en tema oscuro `#A3A3A3`). En el login el texto secundario hoy usa `text-white/70` y `text-white/60`, no el token muted.

## 5. Nombre y logo fuera del cambio de esta pantalla

Solo inventario. No se modifican en este paso.

| Dónde | Qué dice hoy |
|---|---|
| `frontend/index.html` `<title>` | CRM Frisson |
| `frontend/index.html` favicon | `/src/assets/frisson-mark.png` |
| `frontend/src/layout/BrandMark.tsx` | Marca Frisson (`frisson-mark.png` / `frisson-mark-light.png`) más el wordmark «Frisson CRM». Lo usa el login (variante `dark`) y el sidebar. |
| `LoginPage.tsx` | `aria-label="Beneficios de Frisson CRM"` en el panel izquierdo |
| Panel derecho, copys actuales | «Bienvenido de nuevo», «Inicia sesión», «Accede a tu espacio de trabajo y continúa gestionando tus relaciones comerciales.», placeholder `nombre@verytel.com`, botón «Ingresar al CRM» / «Ingresando…» |
| Pie del formulario | `ShieldCheck` + «Acceso seguro para colaboradores autorizados.» — el texto ya es el del diseño |

El logo claro de APOLO no aparece en ningún import.

## 6. Lo que el diseño ya coincide con el código

- Dos columnas desde `lg`; el panel izquierdo oculto por debajo.
- Campos «Correo corporativo» y «Contraseña», con `Eye` / `EyeOff`.
- Error en un `role="alert"` con `text-danger` (`getLoginErrorMessage` en `frontend/src/modules/auth/lib/login-errors.ts`).
- Submit, `useAuth().login`, `navigate(redirectTo)` y el estado `from` no forman parte del cambio visual.

El gutter móvil actual del formulario es `px-5` (20px), no 16px. El panel izquierdo usa `px-12` / `xl:px-20`.
