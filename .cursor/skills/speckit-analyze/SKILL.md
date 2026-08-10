---
name: speckit-analyze
description: Corre el chequeo de consistencia cruzada entre un spec-<módulo>.md ya aprobado, los decision records relevantes, CONSTITUTION.md, AGENTS.md y el estado real del repo — justo ANTES de generar el prompt de implementación de Cursor (backend o frontend). Úsala siempre que Evilio pida generar el prompt de implementación, pasar al siguiente gate, o "ya está aprobado, generemos el prompt" — nunca antes de que el spec esté aprobado (para eso existe speckit-clarify), y nunca en reemplazo de leer el repo real.
---

# speckit-analyze — CRM Frisson

Rol: eres la última línea de defensa antes de que Cursor toque código. No escribes el prompt de implementación tú mismo en esta skill — decides si es seguro generarlo, y si no lo es, lo dices con evidencia concreta.

## Cuándo activarte

- El spec del módulo ya fue marcado como aprobado (gate 1 cerrado).
- Se está por generar el prompt de implementación de backend, o el de frontend después de que el backend ya pasó su propio gate.

## Cuándo NO activarte

- El spec todavía está en revisión / sin aprobar → eso es `speckit-clarify`, no esto.
- Ya se generó el prompt y Cursor ya está ejecutando → demasiado tarde para este chequeo, correspondería a un `NOTAS-BLOQUEO-N.md` si algo falla en ejecución.

## Proceso

### 1. Reunir las cuatro fuentes

1. `spec-<módulo>.md` — versión aprobada, no un borrador anterior.
2. `CONSTITUTION.md` — todos los artículos, no solo el que parezca relevante a simple vista.
3. `AGENTS.md` — inventario técnico vigente.
4. `specs/decisions/*.md` que mencionen el módulo, entidades o patrones involucrados.

Si alguna de las cuatro no está disponible o parece desactualizada, decláralo como hallazgo de bloqueo antes de seguir — no analices con información incompleta.

### 2. Verificar contra el repo real

Antes de dar cualquier veredicto, confirma en el código (no de memoria ni por analogía con otro módulo):

- ¿Los nombres de módulo/carpeta que el spec asume existen tal cual en `backend/` y `frontend/`?
- ¿Las entidades que el spec referencia (tablas, relaciones, FKs) existen con esos nombres y esas relaciones?
- ¿Los componentes/patrones de frontend que el spec da por sentado (paginación, filtros draft/applied, etc.) están donde `AGENTS.md` dice que están?

Este paso existe precisamente por el Artículo II de `CONSTITUTION.md`: la realidad del repo manda sobre los supuestos del spec. Si hay discrepancia, el hallazgo es contra el spec, no contra el repo.

### 3. Chequear las cuatro capas de consistencia

Para cada uno, marca **OK** o **INCONSISTENCIA** con cita exacta (artículo, sección, archivo y línea/decision record):

| # | Chequeo |
|---|---|
| 1 | Spec vs. `CONSTITUTION.md` — ¿algún criterio EARS viola un artículo vigente? |
| 2 | Spec vs. `AGENTS.md` — ¿asume stack, tabla o convención que no coincide con el inventario verificado? |
| 3 | Spec vs. decision records — ¿contradice una decisión ya tomada y registrada, sin una nueva decisión que la reemplace? |
| 4 | Spec vs. repo real — ¿lo confirmado en el paso 2 coincide con lo que el spec asume? |

### 4. Veredicto

- **Si todo está OK:** cierra con la línea exacta **"Sin inconsistencias — listo para generar prompt de implementación."** Esta es la señal para pasar al siguiente gate.
- **Si hay una o más inconsistencias:** no generes el prompt de implementación. Lista cada inconsistencia con su cita, y para cada una ofrece 2–3 opciones concretas de resolución como pregunta de opción múltiple (ej.: "actualizar el spec", "registrar excepción como decision record", "corregir el supuesto sobre el repo"). Esto es una condición de parada — trátala igual que un STOP CONDITION de un prompt autónomo: se documenta y se espera confirmación del arquitecto antes de continuar.

## Formato del reporte

```
speckit-analyze — spec-<módulo>.md

1. Spec vs CONSTITUTION.md ........ OK | INCONSISTENCIA (Artículo N)
2. Spec vs AGENTS.md .............. OK | INCONSISTENCIA (sección N)
3. Spec vs decision records ....... OK | INCONSISTENCIA (archivo)
4. Spec vs repo real ............... OK | INCONSISTENCIA (ruta/archivo)

Veredicto: [Sin inconsistencias — listo para generar prompt de implementación]
           [Bloqueado — N inconsistencias por resolver]
```

## Qué NO hacer

- No generes el prompt de implementación dentro de esta skill, ni siquiera como "borrador mientras se resuelve" — el veredicto bloqueado es un STOP real.
- No marques "OK" un chequeo que no verificaste contra el repo — "parece consistente" no es un OK.
- No repitas hallazgos ya resueltos en `speckit-clarify` salvo que el spec haya cambiado desde entonces.
