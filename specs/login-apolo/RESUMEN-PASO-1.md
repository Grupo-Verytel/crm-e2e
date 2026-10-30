# RESUMEN-PASO-1 — Login APOLO

Fecha: 2026-10-30. Rama `EP-Feature-LoginApolo`, creada desde `develop` ya actualizado (`git pull`: already up to date). Sin commit.

`NOTAS-BLOQUEO-1` queda resuelto con L1: la escena de íconos salió. El centro es solo la órbita. L2 quedó sin efecto: llegaron WebP con fondo transparente, así que el panel izquierdo sigue en `#333333` y no hay token `--login-input`.

## Archivos

| Archivo | Cambio |
|---|---|
| `frontend/src/assets/apolo-orbita.webp` | Ilustración transparente. Es la que importa el login |
| `frontend/src/assets/apolo-logo-dark.webp` | Logo transparente para fondo oscuro. Es el que importa el login |
| `frontend/src/assets/apolo-logo-light.png` | Logo para fondo claro. No se importa (R5) |
| `frontend/src/styles/tokens.css` | `--login-accent: #f88702`. `--login-panel-left` sigue `#333333`. `--accent` no se tocó |
| `frontend/tailwind.config.js` | `login-accent` |
| `frontend/src/styles/global.css` | El botón y el ojo del login usan `--login-accent` sin cambiar `.btn-glow` del resto de la app. Los inputs siguen con `--login-panel-left` |
| `frontend/src/modules/auth/pages/LoginPage.tsx` | Capa visual. Submit, `login`, `navigate` y `from` iguales |

Los PNG de órbita y logo oscuro (incluidos los de nombre en español) no están en el working tree.

No se tocaron `index.html`, `BrandMark.tsx`, `ThemeProvider` ni el sidebar.

## Qué quedó en pantalla

- Panel izquierdo en `#333333`: logo oscuro, órbita fija, slider y pie de fases. Los dos assets son WebP transparentes.
- Nota nueva primera: «Una misión compartida.» en blanco y «Todo el recorrido conectado.» en `login-accent`, ambas a tamaño de título.
- Las tres notas anteriores conservan título, descripción, el renglón «Creamos relaciones a largo plazo», los puntos y los 6000 ms. `prefers-reduced-motion` sigue cortando el intervalo.
- Punto activo en `login-accent`.
- Panel derecho: copys pedidos, placeholder `nombre@grupoverytel.com`, botón «Ingresar a APOLO», ojo con borde `login-accent`.
- Bajo `lg` el panel izquierdo no se muestra y el logo oscuro va arriba del formulario, que conserva `bg-login-right`. El gutter sigue en `px-5`.

## Verificación

- `npx tsc --noEmit` en `frontend/`: sin errores.
- `npm run build`: correcto. El bundle incluye `apolo-logo-dark.webp` y `apolo-orbita.webp`. `apolo-logo-light.png` no entra.

En el navegador, sobre `http://localhost:5173/login`, después de los WebP:

- Escritorio (1440×900): dos columnas. Fondo izquierdo `rgb(51, 51, 51)` (`#333333`), formulario `rgb(28, 28, 28)`. Esquinas de ambos WebP con alpha 0 y ningún píxel opaco negro. En la captura no hay recuadro alrededor del logo ni de la órbita.
- La primera nota muestra las dos líneas. La segunda está en `rgb(248, 135, 2)`. El slider siguió rotando a las notas existentes. Los separadores del pie también son `rgb(248, 135, 2)`.
- Tema oscuro: `--accent` pasa a `#c25e00` y el naranja del login se queda en `#f88702` (`rgb(248, 135, 2)`), igual que en claro.
- Mostrar/ocultar contraseña cambia el tipo del campo y el nombre accesible del botón. El borde es `rgb(248, 135, 2)`.
- Móvil (390×844): panel izquierdo `display: none`, logo visible arriba sobre `bg-login-right` (`rgb(28, 28, 28)`), sin recuadro. `scrollWidth` igual al ancho. Sin scroll horizontal.

No se envió el formulario. El bloque `role="alert"` y `getLoginErrorMessage` no se modificaron. Login correcto y credenciales inválidas quedan en el guion de abajo.

## Guion manual

1. Abrir `/login` en escritorio. El slider arranca en «Una misión compartida.» / «Todo el recorrido conectado.» y, a los 6 segundos, pasa a «Relaciones que crecen» y sigue con las otras dos.
2. Entrar con un usuario válido. La redirección es la de antes (`from`, o `/opportunities`).
3. Credenciales inválidas. Sigue el aviso «Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.», legible sobre el fondo oscuro.
4. Mostrar y ocultar la contraseña.
5. Cambiar el tema de la app a oscuro y volver a claro. El naranja del login no cambia.
6. Ventana menor de 1024px: no hay panel izquierdo, el logo queda arriba del formulario y no aparece scroll horizontal. Órbita y logo sin recuadro negro, en escritorio y en móvil.
