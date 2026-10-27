# Tasks

## 1. Definición del esquema y migración inicial

- [x] 1.1 Crear `lib/schema.ts` con `responsables`, `proyectos` (con `UNIQUE (nombre)` y `CHECK` de estado), `items_meta` (con `UNIQUE (id, proyecto_id)`, `CHECK` de meta y costo positivos) y `apoyantes` (con `CHECK (es_donante OR es_voluntario)`); verificar con `npx tsc --noEmit` que compila sin errores
- [x] 1.2 Añadir a `lib/schema.ts` `donaciones` con la FK compuesta `(item_id, proyecto_id) → items_meta (id, proyecto_id)`, el `CHECK` nombrado `donaciones_estado_valido` de tres estados, `CHECK` de tipo y medio, `anulada` por defecto falso, y las FK a apoyante, proyecto, responsable y donación vinculada sin `CASCADE`; verificar con `npx tsc --noEmit`
- [x] 1.3 Añadir `voluntarios_inscritos` y `audit_log` (con índice `(entidad, entidad_id)`) y los índices de `donaciones (item_id)`, `(proyecto_id)`, `(apoyante_id)` e `items_meta (proyecto_id)`; verificar con `npx tsc --noEmit`
- [x] 1.4 Crear `drizzle.config.ts` que lee `DATABASE_URL_UNPOOLED` y falla nombrando la variable si falta, y añadir los scripts `db:generate` y `db:migrate` a `package.json`; verificar que `npm run db:generate` sin la variable termina con un error que nombra `DATABASE_URL_UNPOOLED` sin imprimir ningún valor
- [x] 1.5 Ejecutar `npm run db:generate` y revisar el SQL de `drizzle/`; verificar que contiene las siete tablas, la FK compuesta, `donaciones_estado_valido` y el `UNIQUE (id, proyecto_id)`, y que volver a ejecutar `db:generate` no produce una migración nueva
- [x] 1.6 Pasar `{ schema }` a `drizzle()` en `lib/db-client.ts` sin cambiar su comportamiento; verificar que `npm run build` y `npm run db:check` siguen pasando

## 2. Pruebas de integridad en una rama descartable

- [x] 2.1 Crear la rama de Neon `test-esquema` desde `production` (con el CLI de Neon, tras confirmación del usuario) y guardar su cadena en `.env.test`; verificar con `git check-ignore .env.test` que queda ignorado y que ningún archivo versionado contiene la cadena
- [x] 2.2 Crear el script `npm run db:test` que carga `.env.test`, aplica las migraciones a esa rama y ejecuta las pruebas con `node:test` bajo `tsx`; verificar que sin `.env.test` termina con un error que nombra la variable y que nunca apunta a `production`
- [x] 2.3 Escribir las pruebas de `database-schema` para estados, valores permitidos y metas (estado inválido, meta 0, costo nulo aceptado), cada una en una transacción que se revierte; verificar que `npm run db:test` las pasa
- [x] 2.4 Escribir las pruebas de los tres estados de donación: dinero válido y sin asignar, dinero sin monto positivo, dinero con ítem o cantidad, producto asignado válido, cantidad no positiva, ítem sin proyecto, proyecto sin ítem, producto sin asignar con y sin descripción, e ítem de otro proyecto; verificar que cada rechazo falla por la restricción esperada (nombre de restricción) y que `db:test` pasa
- [x] 2.5 Escribir las pruebas de anulación (valor por defecto y fila conservada), `registrado_por` obligatorio, desactivación de responsable sin tocar sus donaciones, donación vinculada válida e inexistente, apoyante sin rol, `audit_log` completo y sin responsable, e inscripción con y sin apoyante; verificar que `db:test` pasa
- [x] 2.6 Verificar la migración repetida: ejecutar `db:migrate` dos veces sobre la rama de pruebas; verificar que la segunda termina con código 0 y sin cambios

## 3. Datos iniciales

- [x] 3.1 Crear `scripts/seed.ts` y el script `npm run db:seed` que insertan los 4 proyectos con `ON CONFLICT (nombre) DO NOTHING` (`tiene_meta` verdadero solo en 10 Derechos y Apoyo alimentario) y no crean responsables, apoyantes, ítems ni donaciones; verificar que contiene un texto descriptivo por proyecto tomado del PRD y ninguna cuenta ni dato personal
- [x] 3.2 Escribir las pruebas de `initial-project-data` contra la rama de pruebas: cuatro proyectos tras la carga, dos ejecuciones sin duplicar, un proyecto editado que conserva su estado y descripción, y las demás tablas vacías; verificar que `npm run db:test` las pasa

## 4. Aplicación a `production` y documentación

- [x] 4.1 Con confirmación del usuario, ejecutar `npm run db:migrate` y `npm run db:seed` contra `production`; verificar con una consulta de solo lectura que existen las siete tablas y los cuatro proyectos, y que las otras tablas están vacías
- [x] 4.2 Actualizar `CLAUDE.md` con los comandos `db:generate`, `db:migrate`, `db:seed` y `db:test`, la variable `DATABASE_URL_UNPOOLED` y la regla de que las pruebas nunca apuntan a `production`; verificar que cada comando documentado se ejecuta como está escrito y que el archivo no contiene valores reales

## 5. Verificación de integración

- [x] 5.1 Desde una instalación limpia (`npm ci`) con Node 22, ejecutar `npm run build`, `npm run db:test` y `npm run db:check`; verificar código de salida 0 en los tres y que cada requisito de `database-schema` e `initial-project-data` tiene una prueba que lo cubre
- [x] 5.2 Ejecutar `openspec validate esquema-base-datos --strict`; verificar que no reporta errores

## Workflow follow-up

- Archivar el cambio cuando se cumplan los requisitos de revisión del proyecto.
- El ítem #3 (Acceso de responsables) depende de este esquema y crea el responsable inicial.
