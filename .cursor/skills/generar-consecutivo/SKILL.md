---
name: generar-consecutivo
description: Genera IDs consecutivos únicos, auto-generados y NUNCA editables (OUV, PRE, PRI, SER, ACT-PRE) para el CRM Frisson, con bloqueo atómico de fila que evita duplicados en concurrencia. Úsalo cuando implementes el servicio de creación de cualquier entidad que requiera numeración consecutiva (oportunidades, preventas, pricing, servicios, actividades).
paths:
  - "backend/src/modules/**/*.service.ts"
  - "backend/src/modules/**/*.repository.ts"
---

# Generación de consecutivos — CRM Frisson

## Formatos vigentes (fuente: Blueprint V2, Entregable 2 y 3)

| Entidad | Formato | Ejemplo | Alcance de la secuencia |
|---|---|---|---|
| Oportunidad (OUV) | `OUV-####-Nombre_Cliente` | `OUV-0010-Arturo_Calle` | Global, tabla `ouvs` |
| Preventa (PRE) | `PRE-####` | `PRE-0110` | Global, tabla `preventas`, 1:1 asociado a una OUV |
| Actividad de preventa (ACT-PRE) | `ACT-PRE-####-###` | `ACT-PRE-0042-001` | **Jerárquico** — scoped por `pre_id` (el padre). Reinicia en 1 para cada PRE nuevo. |
| Pricing (PRI) | `PRI-####` | `PRI-0090` | Global, tabla `pricing` |
| Servicio (SER) | `SER-####` | `SER-0210` | Global, tabla `servicios`. Una OUV puede generar N servicios (SER-0210, SER-0211, SER-0212...) |

`####` = 4 dígitos con zero-pad. `###` en ACT-PRE = 3 dígitos con zero-pad sobre el `seq_num` local.

## Reglas no negociables

1. El campo `consecutivo` es **auto-generado, único globalmente y NUNCA editable** desde el frontend ni por el usuario.
2. La generación **siempre ocurre dentro de una transacción**, nunca calculando el próximo número por fuera y luego insertando (race condition garantizada bajo carga concurrente — dos KAMs creando OUV al mismo tiempo duplicarían el número).
3. Para consecutivos jerárquicos (ACT-PRE), el `seq_num` se calcula **con bloqueo de fila sobre el padre**, no sobre la tabla hija completa.

## Patrón de referencia (consecutivo jerárquico — el caso más estricto)

Del Blueprint, la regla exacta para `actividades_preventa`:

```
seq_num = SELECT COALESCE(MAX(seq_num), 0) + 1
          FROM actividades_preventa
          WHERE pre_id = ?
          FOR UPDATE
```

El `FOR UPDATE` bloquea las filas existentes de ese `pre_id` hasta que la transacción termina, así que una segunda inserción concurrente para el mismo PRE espera su turno en vez de leer el mismo `MAX(seq_num)`.

### Implementación NestJS + Sequelize (MySQL)

```typescript
// actividades-preventa.service.ts
import { Injectable } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { Transaction } from 'sequelize';
import { InjectModel } from '@nestjs/sequelize';
import { ActividadPreventa } from './models/actividad-preventa.model';
import { Preventa } from '../preventa/models/preventa.model';

@Injectable()
export class ActividadesPreventaService {
  constructor(
    private readonly sequelize: Sequelize,
    @InjectModel(ActividadPreventa)
    private readonly actividadModel: typeof ActividadPreventa,
    @InjectModel(Preventa)
    private readonly preventaModel: typeof Preventa,
  ) {}

  async crearActividad(preId: string, dto: CrearActividadDto, usuarioId: string) {
    return this.sequelize.transaction(async (t: Transaction) => {
      // 1. Bloquea la fila padre (PRE) — evita que dos requests concurrentes
      //    calculen el mismo seq_num para el mismo pre_id.
      const preventa = await this.preventaModel.findByPk(preId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!preventa) throw new NotFoundException('Preventa no encontrada');

      // 2. Calcula el siguiente seq_num dentro de la misma transacción
      const maxSeq = await this.actividadModel.max<number, ActividadPreventa>(
        'seq_num',
        { where: { pre_id: preId }, transaction: t },
      );
      const seqNum = (maxSeq ?? 0) + 1;

      // 3. Arma el consecutivo jerárquico con zero-pad de 3 dígitos
      const consecutivo = `ACT-${preventa.consecutivo}-${String(seqNum).padStart(3, '0')}`;

      // 4. Inserta dentro de la misma transacción
      return this.actividadModel.create(
        {
          ...dto,
          pre_id: preId,
          seq_num: seqNum,
          consecutivo,
          created_by: usuarioId,
        },
        { transaction: t },
      );
    });
  }
}
```

### Patrón para consecutivos globales (OUV, PRE, PRI, SER)

Mismo principio, pero el bloqueo se toma sobre una tabla de contadores dedicada (recomendado) en vez de sobre `MAX()` de la tabla completa — más barato conforme la tabla crece:

```typescript
// counters.service.ts — tabla dedicada `secuenciadores` (prefijo VARCHAR PK, ultimo_valor INT)
async obtenerSiguienteConsecutivo(prefijo: 'OUV' | 'PRE' | 'PRI' | 'SER', t: Transaction): Promise<number> {
  const [contador] = await this.sequelize.query(
    `SELECT ultimo_valor FROM secuenciadores WHERE prefijo = :prefijo FOR UPDATE`,
    { replacements: { prefijo }, transaction: t, type: QueryTypes.SELECT },
  );
  const siguiente = (contador?.ultimo_valor ?? 0) + 1;
  await this.sequelize.query(
    `UPDATE secuenciadores SET ultimo_valor = :siguiente WHERE prefijo = :prefijo`,
    { replacements: { siguiente, prefijo }, transaction: t },
  );
  return siguiente; // luego formatea: `OUV-${String(siguiente).padStart(4, '0')}-${nombreCliente}`
}
```

Usa este patrón (tabla `secuenciadores`) en vez de `MAX()` para OUV/PRE/PRI/SER — son de alto volumen y `MAX()` sobre toda la tabla se degrada con el tiempo; `MAX()` con `WHERE pre_id=?` sí es aceptable para ACT-PRE porque el scope siempre es pequeño (pocas actividades por preventa).

## Anti-patrones a evitar

- ❌ Generar el consecutivo con `Date.now()` o UUID truncado — rompe el formato de negocio y la trazabilidad esperada por el equipo comercial.
- ❌ Calcular `MAX(seq_num)` o el contador **fuera** de la transacción y luego insertar — condición de carrera.
- ❌ Usar `AUTO_INCREMENT` nativo de MySQL como consecutivo de negocio — no permite el prefijo, el padding, ni el scope jerárquico (ACT-PRE reinicia por PRE padre).
- ❌ Permitir `consecutivo` como campo editable en el DTO de actualización — debe excluirse explícitamente de cualquier UPDATE DTO.

## Checklist de testing (ver skill `registrar-auditoria` para el registro asociado)

- Test de concurrencia: disparar N creaciones simultáneas para el mismo `pre_id` (o mismo prefijo global) y verificar que no hay `seq_num` ni consecutivos duplicados.
- Test de formato: verificar zero-pad correcto (`001`, no `1`) y prefijo correcto por tipo de entidad.
- Test de inmutabilidad: verificar que un intento de `UPDATE` sobre `consecutivo` es rechazado a nivel de DTO/servicio, no solo de UI.
