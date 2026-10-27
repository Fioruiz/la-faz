# ADR 0002: Modelo de datos relacional con donaciones en una sola tabla, avance calculado e historial en `audit_log`

## Estado

Aceptado

## Contexto

El PRD exige registrar donaciones en dinero o en producto contra metas por ítem (por ejemplo,
2000 packs), mostrar el avance público y privado, llevar apoyantes (donantes y voluntarios) y
guardar un historial de cambios con quién y cuándo. No hay `Design.md`, así que las entidades se
derivan solo del PRD. La persistencia es PostgreSQL en Neon (ver [ADR 0001](0001-aplicacion-unica-nextjs.md)).

Los casos borde del PRD que condicionan el modelo: donación "Sin asignar" que no cuenta en ninguna
barra, excedente sobre la meta, anulación en lugar de borrado, donante anónimo, donación mixta
como dos donaciones vinculadas, aviso de duplicados, desactivación de responsables y proyecto
"Finalizado". El criterio de éxito "la barra pública coincide exactamente con lo registrado en la
zona privada" exige que el avance no pueda desincronizarse.

## Decisión

Tres decisiones sobre el modelo, todas elegidas por el usuario:

1. **Donaciones (2a-A):** una sola tabla `donaciones` con columna `tipo` (`dinero` | `producto`).
   Los campos `monto` y `item_id`/`cantidad` son opcionales según el tipo y se garantizan con una
   restricción `CHECK`.
2. **Avance (2b-A):** el avance de cada ítem se calcula siempre con una consulta (`SUM` de las
   donaciones no anuladas asignadas a ese ítem). No se guarda ningún contador.
3. **Historial (2c-A):** una tabla genérica `audit_log` (entidad, id, acción, valores antes/después
   en JSON, responsable, fecha), escrita desde la aplicación en la misma transacción que el
   cambio.

Entidades principales:

- `responsables`: usuario con login; campo `activo` para desactivar sin borrar registros.
- `proyectos`: nombre, descripción, `tiene_meta`, estado (`activo` | `finalizado`), resultado.
- `items_meta`: proyecto, nombre, unidad, `cantidad_meta`, `costo_referencial` opcional.
- `apoyantes`: nombre, contacto, rol (donante y/o voluntario), `anonimo_publico`.
- `donaciones`: apoyante, proyecto (nulo = "Sin asignar"), `item_id` y `cantidad` (producto) o
  `monto` (dinero), medio, fecha, registrado_por, `anulada`, `donacion_vinculada_id` (caso mixto).
- `voluntarios_inscritos`: datos del formulario público de voluntariado, vinculados a un apoyante.
- `audit_log`: historial de cambios descrito arriba.

## Alternativas consideradas

- **Tabla base `donaciones` con tablas hijas por tipo** — más normalizada y sin columnas nulas,
  pero toda consulta de avance y de reporte necesita joins y la donación mixta se complica. No se
  eligió por complejidad innecesaria para este volumen.
- **Contador `cantidad_recibida` guardado en el ítem** — lectura más rápida, pero puede
  desfasarse ante ediciones o anulaciones y contradice el criterio de coincidencia exacta. No se
  eligió.
- **Triggers de Postgres para el historial** — no se les escapa ningún cambio, pero la lógica
  queda en la base, es más difícil de probar y no conoce al usuario de la aplicación sin trucos
  extra. No se eligió.
- **Columnas `creado_por`/`editado_por`/`actualizado_en` sin historial completo** — lo más simple,
  pero solo guarda el último cambio y no cumple "cada cambio guarda quién y cuándo". No se eligió.

## Consecuencias

- El avance no puede desincronizarse de las donaciones: público y privado leen la misma consulta.
- Un solo `audit_log` cubre donaciones, proyectos y apoyantes, y las consultas de reporte usan
  una sola tabla de donaciones.
- Costo: la tabla `donaciones` tiene columnas nulas según el tipo y depende de un `CHECK` para
  mantener la integridad.
- Costo: cada lectura de avance ejecuta un `SUM`; con cientos o miles de filas es trivial, pero si
  el volumen creciera mucho habría que añadir caché o una vista materializada.
- Costo: el historial depende de que toda escritura pase por la capa de aplicación; un cambio
  hecho directo en la base (por ejemplo, desde la consola de Neon) no quedaría registrado.
- Datos personales de donantes y voluntarios en `apoyantes`: el acceso a la zona privada debe
  protegerse (riesgo ya señalado en el PRD).
