# ADR 0007: Módulo único de lecturas públicas para separar datos públicos y privados

## Estado

Aceptado. Reemplazado en parte por el [ADR 0011](0011-endurecimiento-antes-de-datos-reales.md): la zona pública ahora lee con un rol de Postgres de solo lectura, no con la conexión única.

## Contexto

El PRD guarda datos personales de donantes y voluntarios (con una referencia a la ley peruana de
protección de datos personales) y exige que el donante anónimo se muestre como "Anónimo" en
público, con su nombre real solo en la zona privada. Las donaciones "Sin asignar" tampoco deben
contar en ninguna barra. La zona pública y la privada comparten base y código
([ADR 0001](0001-aplicacion-unica-nextjs.md)), por lo que una consulta pública mal escrita podría
filtrar nombres, contactos o donaciones sin asignar. La zona pública solo necesita proyectos,
metas y totales de avance.

## Decisión

Un único módulo de lecturas públicas (por ejemplo, `lib/public-queries.ts`) es la única vía por
la que las páginas públicas leen de la base. Devuelve solo proyectos, ítems, cantidades y totales
de avance (sin contar donaciones anuladas ni "Sin asignar"), y los nombres de donante solo como
"Anónimo" o el nombre autorizado para mostrarse. Ninguna página pública consulta tablas
directamente. Esta regla se anota en `CLAUDE.md`. La conexión a Postgres es una sola, sin roles
separados.

## Alternativas consideradas

- **Rol de Postgres de solo lectura con acceso únicamente a vistas públicas** — defensa en
  profundidad: aunque el código falle, la zona pública no podría leer `apoyantes`. No se eligió
  por el costo de configuración (dos cadenas de conexión en Vercel, roles y permisos en Neon,
  migraciones de las vistas) en un proyecto de prueba. Sería el paso siguiente si el sistema
  manejara datos reales.
- **Filtrado en cada página, sin separación explícita** — lo más rápido, pero es la opción con más
  riesgo de filtración. No se eligió.

## Consecuencias

- Un solo lugar que revisar para saber qué datos salen en público, y reglas como "excluir anuladas
  y sin asignar" viven en un único sitio.
- Costo: la protección depende de la disciplina del código; la misma conexión con permisos
  completos sirve a la zona pública, así que una consulta mal escrita, o saltarse el módulo, puede
  exponer datos personales sin que la base lo impida.
- Costo: hay que hacer cumplir la regla en revisiones de código; no hay una comprobación
  automática salvo que se añada una prueba que revise las respuestas públicas.
- No resuelve por sí misma el cumplimiento de la ley de protección de datos personales del Perú
  (riesgo abierto del PRD, no verificado).
