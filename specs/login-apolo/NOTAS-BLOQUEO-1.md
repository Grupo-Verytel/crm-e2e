# NOTAS-BLOQUEO-1 — Escena de íconos del slider

> **RESUELTO 2026-10-30.** L1 = opción 1: la escena de íconos sale y el centro queda solo con la órbita fija. L3 y L4 siguen vigentes. L2 quedó sin efecto el mismo día: los assets transparentes no piden panel negro ni `--login-input`. El Paso 1 está en `RESUMEN-PASO-1.md`. Este archivo se conserva como histórico del stop.

Fecha: 2026-10-30. Paso 0. Condición del propio paso («si el slider hoy muestra imágenes que la ilustración nueva reemplazaría, detente») y R7. No se tocó código de producto. El descubrimiento está en `RESUMEN-PASO-0.md`.

## Qué pide el diseño

En el centro del panel izquierdo, la ilustración `Órbita espacial de cuatro etapas.png` queda fija. Debajo sigue el slider de notas, con una nota nueva como primera. Las notas actuales conservan texto, orden relativo e intervalo.

## Qué hay en el código

`LOGIN_SLIDES` en `frontend/src/modules/auth/pages/LoginPage.tsx` no tiene imágenes. Cada nota sí elige dos íconos de lucide-react (`icon` y `detailIcon`). Esos íconos se dibujan en el centro del panel, dentro de una tarjeta CSS con círculos, y cambian cuando rota la nota (cada 6000 ms). El texto (título y descripción) va debajo de esa escena. Los puntos del slider también están ahí.

La ilustración nueva ocuparía ese mismo centro.

## Por qué no sigo

Quitar la escena de íconos la decide el diseño de la órbita fija, pero el paso 0 pide no decidir si se quita lo que hoy ocupa ese lugar. Dejar las dos cosas (órbita fija y escena que rota) tampoco está escrito.

Hasta haber una respuesta, el Paso 1 no arranca.

## Qué se necesita

Una de estas dos:

1. La escena de íconos sale. El centro queda solo con la órbita fija. El slider conserva título, descripción, puntos y el intervalo de 6000 ms, y la nota nueva entra primera.
2. La escena de íconos se queda, y hay que decir dónde vive respecto a la órbita.
