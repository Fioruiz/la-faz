# Tasks

## 1. Esquemas de validación

- [x] 1.1 Crear `lib/proyectos-esquemas.ts` con los esquemas Zod de crear proyecto, editar proyecto, finalizar, crear ítem y editar ítem (límites de texto, meta entera 1–1.000.000, costo con punto o coma y dos decimales como máximo, vacío a `null`, casilla de meta a booleano, ids coercidos); verificar con `npx tsc --noEmit`
- [x] 1.2 Escribir `tests/proyectos-esquemas.test.ts` (sin base) con un caso por límite de los specs: nombre vacío y de 101 caracteres, descripción de 1001, unidad de 31, meta 0, negativa, decimal y 1.000.001, costo "13", "13.5", "13,50", "", "0", "-1", "13.505", "abc" y "10000000", y resultado vacío o de 2001; verificar que `npm run db:test` las pasa

## 2. Lecturas privadas

- [x] 2.1 Cambiar `crearConsultasPrivadas(requerir)` a `crearConsultasPrivadas(requerir, db)` en `lib/private-queries-core.ts` y añadir `listarProyectos()` (proyectos con estado, si tienen meta y cantidad de ítems) y `getProyecto(id)` (proyecto con sus ítems ordenados por nombre, o `null`; id inválido devuelve `null` sin consultar); actualizar `lib/private-queries.ts` con `getDb()` y los sitios de `tests/private-access.test.ts` que llaman a la fábrica; verificar con `npx tsc --noEmit` y que `npm run db:test` sigue pasando
- [x] 2.2 Escribir pruebas de las lecturas contra la rama de pruebas: la lista incluye activos y finalizados con la cantidad de ítems, `getProyecto` devuelve los ítems ordenados, un id inexistente o inválido devuelve `null`, y las dos consultas nuevas rechazan a un responsable desactivado y a un id inexistente (la prueba existente que recorre todas las consultas debe cubrirlas sin registrarlas); verificar que `npm run db:test` las pasa

## 3. Escrituras de proyectos

- [x] 3.1 Crear `lib/proyectos-escrituras.ts` con `crearProyecto`, `editarProyecto` y `finalizarProyecto` (`escribir` de cada una): bloqueo de la fila del proyecto con `for update` al editar o finalizar, unicidad de nombre sin distinguir mayúsculas ni espacios con traducción de `23505`, reglas de proyecto finalizado, de proyecto con ítems sin meta y de edición sin cambios, y su historial (`crear`, `editar`, `finalizar`) con solo campos de negocio; verificar con `npx tsc --noEmit`
- [x] 3.2 Escribir `tests/proyectos-escrituras.test.ts` para las tres escrituras ejecutadas con `ejecutarEscrituraAuditada()`: creación con y sin meta, historial de creación, nombre repetido con otra capitalización al crear y al editar, edición con cambios (historial con antes y después), edición sin cambios, quitar la meta con ítems, proyecto inexistente, finalizar con resultado, resultado vacío, finalizar dos veces, editar un finalizado y finalizar con metas sin cumplir; verificar que `npm run db:test` las pasa

## 4. Escrituras de ítems

- [x] 4.1 Añadir `crearItem` y `editarItem` a `lib/proyectos-escrituras.ts`: bloqueo del proyecto con `for update`, proyecto sin meta o finalizado, nombre único dentro del proyecto sin distinguir mayúsculas ni espacios, ítem que no pertenece al proyecto indicado, edición sin cambios, costo vacío a `null`, y su historial (`crear` y `editar`, entidad `item_meta`); verificar con `npx tsc --noEmit`
- [x] 4.2 Escribir las pruebas de ítems: creación válida con y sin costo, costo con coma, quitar el costo al editar, nombre repetido en el mismo proyecto y permitido en otro, proyecto sin meta, proyecto finalizado, ítem de otro proyecto, bajar la meta por debajo de lo recibido (con una donación en producto creada en la prueba), sin cambios, historial con antes y después y atribución al responsable de la sesión; verificar que `npm run db:test` las pasa
- [x] 4.3 Escribir la prueba de concurrencia con conexión real del pool (con limpieza propia de sus filas): finalizar un proyecto y crear un ítem a la vez deja siempre un resultado coherente (si el cierre gana, el ítem se rechaza), y una variante sin el `for update` hace fallar la prueba; verificar que pasa y que falla con la variante (revertirla)

## 5. Acciones y pantallas

- [x] 5.1 Crear `app/(privado)/proyectos/actions.ts` con las cinco acciones usando `crearAccionPrivada()` y los pares de los pasos 1, 3 y 4, sin ninguna acción de borrado; verificar con `npx tsc --noEmit`, que `tests/escritura-auditada-estructura.test.ts` sigue pasando y con una prueba estructural nueva que falla si algún archivo de proyectos o ítems usa `.delete(`
- [x] 5.2 Crear las páginas `/proyectos` (lista con estado, meta y cantidad de ítems, y botón "Nuevo proyecto") y `/proyectos/nuevo`, con formularios de cliente con `useActionState` que muestran los errores por campo y el mensaje de regla y reponen lo escrito; añadir un enlace "Proyectos" en el panel; verificar con `npm run build` que ambas rutas aparecen como dinámicas
- [x] 5.3 Crear `/proyectos/[id]` con los datos y el formulario de edición del proyecto, la tabla de ítems con edición por fila, el formulario "Agregar ítem" (solo si el proyecto está activo y tiene meta), el formulario de finalización y la vista de solo lectura con el resultado de un proyecto finalizado, y una página de no encontrado para ids inexistentes o no numéricos; verificar con `npm run build` y `npx tsc --noEmit`
- [x] 5.4 Verificación manual en el navegador contra la rama de pruebas de Neon (nunca producción): iniciar sesión con un responsable de prueba, crear un proyecto con meta, agregar un ítem con y sin costo, editarlo, provocar un error de validación y comprobar que se conserva lo escrito, provocar un nombre repetido, finalizar el proyecto y comprobar que queda de solo lectura con su resultado; después borrar los datos de prueba y el responsable de prueba; verificar que cada paso se comporta como indica la spec

## 6. Documentación e integración

- [x] 6.1 Añadir a `CLAUDE.md` una nota breve de proyectos e ítems (reglas: ítems solo en proyectos con meta, finalizado de solo lectura, sin borrado, costo referencial por unidad); verificar que la nota coincide con el código
- [x] 6.2 Ejecutar `npm run build`, `npm run lint`, `npx tsc --noEmit` y `npm run db:test`; verificar código de salida 0 y que cada requisito de `project-management` y `goal-items` tiene al menos una prueba o una verificación manual anotada
- [x] 6.3 Ejecutar `openspec validate proyectos-items-meta --strict`; verificar que no reporta errores

## Workflow follow-up

- Pasar el cambio por el `code-reviewer` antes de archivar y archivarlo cuando se cumplan los requisitos de revisión del proyecto.
- Los ítems #7 (registrar donación, que rechaza proyectos finalizados) y #9 (avance y "falta en soles") reutilizan `getProyecto()` y las reglas de este cambio.
- Si se decide permitir borrar o reabrir proyectos e ítems, actualizar el PRD primero.
