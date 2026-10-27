# Proposal

## Why

La aplicación ya compila y se conecta a Neon (ítem #1), pero la base está vacía. Todos los ítems siguientes (login, escritura auditada, proyectos, apoyantes, donaciones, avance, reportes y sitio público) leen y escriben tablas que aún no existen. Fijar ahora el esquema, con sus restricciones de integridad (ADR 0008), evita que cada ítem invente su propia versión de las tablas y hace que la base misma impida las combinaciones incoherentes de proyecto, ítem y donación, que amenazarían el criterio del PRD "la barra pública coincide exactamente con lo registrado".

## What Changes

Alcance estricto del ítem #2 del backlog ("Esquema de base de datos"):

- Definir con Drizzle todas las tablas del TDD v2: `responsables`, `proyectos`, `items_meta`, `apoyantes`, `donaciones`, `voluntarios_inscritos` y `audit_log`.
- En `items_meta`, `UNIQUE (id, proyecto_id)`; en `donaciones`, la clave foránea compuesta `(item_id, proyecto_id) → items_meta (id, proyecto_id)` y el `CHECK` de tres estados válidos (dinero, producto asignado, producto sin asignar) del ADR 0008.
- Declarar los demás `CHECK`, claves foráneas, valores por defecto e índices que el TDD y el PRD implican (estado del proyecto, medio de pago, rol del apoyante, `donacion_vinculada_id`, `anulada`, `activo`).
- Generar la migración inicial con `drizzle-kit`, versionada en el repositorio, y un comando para aplicarla a Neon.
- Cargar datos iniciales: los 4 proyectos de La FAZ (10 Derechos, Apoyo alimentario, Música, Casa del Buen Samaritano), con `tiene_meta` verdadero solo en los dos primeros. El script de carga es repetible (no duplica filas al ejecutarse otra vez).
- Pruebas de integridad contra una base real que demuestran que cada combinación rechazada por el ADR 0008 falla y cada combinación válida se acepta.

Fuera de alcance (pertenecen a otros ítems): responsable inicial y contraseñas (#3), `requireResponsableActivo()` y cualquier capa de acceso privado (#3, #4), escritura en `audit_log` desde la aplicación (#4), ítems con meta de los proyectos (#5), funciones de avance y "falta en soles" (#9), `lib/public-queries.ts` (#12), cualquier pantalla, y la zona horaria `America/Lima`, el respaldo y los roles de base de datos (#14).

## Capabilities

### New Capabilities
- `database-schema`: la base define las entidades del TDD v2 y garantiza por sí sola la integridad entre proyecto, ítem y donación (FK compuesta y `CHECK` de tres estados), la anulación sin borrado y la desactivación de responsables sin perder sus registros; el esquema se aplica mediante migraciones versionadas y repetibles.
- `initial-project-data`: tras aplicar el esquema, la base contiene los 4 proyectos de La FAZ con su indicador de meta correcto, y cargar los datos iniciales varias veces no los duplica.

### Modified Capabilities
<!-- Ninguna: no existen specs previos en openspec/specs/. La spec database-connection del ítem #1 sigue en su propio cambio sin archivar y no se modifica aquí. -->

## Impact

- **Código nuevo:** definición del esquema Drizzle (`lib/schema.ts` o equivalente), configuración de `drizzle-kit`, carpeta de migraciones, script de datos iniciales y pruebas de integridad.
- **Código existente:** `lib/db-client.ts` puede pasar el esquema a `drizzle()`; no cambia su comportamiento. `package.json` recibe scripts para migrar, cargar datos iniciales y probar el esquema.
- **Dependencias nuevas:** ninguna de runtime; se reutilizan `drizzle-orm` y `drizzle-kit` ya instalados. Si las pruebas necesitan un ejecutor, se usa `tsx` (ya instalado) con `node:test`, sin añadir un framework.
- **Sistemas externos:** la rama `production` del proyecto Neon recibe las tablas. Las pruebas se ejecutan en una rama de Neon descartable para no ensuciar datos reales (a confirmar en el diseño).
- **Documentación:** `CLAUDE.md` gana los comandos de base de datos; PRD, TDD y ADR no cambian.
- **Pendientes del TDD que se tocan:** A7 se resuelve solo en lo necesario para definir tipos (monto y fecha); la zona horaria queda para #14. A2 y A3 no se tocan.
