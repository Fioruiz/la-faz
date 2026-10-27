# Tasks

## 1. Reglas compartidas

- [x] 1.1 Extraer de `lib/donaciones-escrituras.ts` a `lib/donaciones-reglas.ts` las reglas de fecha no futura, proyecto e ítem (con `for share`), búsqueda de duplicados con `excluirId` y el mensaje de duplicado, y hacer que `registrarDonacion` las use sin cambiar su comportamiento; verificar con `npx tsc --noEmit` y que `tests/donaciones-escrituras.test.ts` y `tests/donaciones-concurrencia.test.ts` siguen pasando sin cambios

## 2. Esquemas de edición, asignación y anulación

- [x] 2.1 Añadir `ValidacionError` al núcleo (el ejecutor la devuelve como validación por campo y revierte) y crear `lib/donaciones-correcciones-esquemas.ts` con los esquemas de editar y asignar (solo `donacionId`; el resto se valida dentro de la escritura con `registrarDonacionEsquema` y el tipo y el donante de la fila) y de anular (`donacionId` y motivo de 1 a 200 caracteres recortado); verificar con `npx tsc --noEmit`
- [x] 2.2 Escribir `tests/donaciones-correcciones-esquemas.test.ts` (sin base) para el motivo vacío, solo espacios, de 200 y de 201 caracteres y los ids inválidos, y una prueba de `ValidacionError` en `tests/escritura-auditada.test.ts` (devuelve validación con los campos, conserva lo escrito y revierte); verificar que pasan

## 3. Lecturas privadas

- [x] 3.1 Añadir `listarDonaciones({ filtro, busqueda })` (100 más recientes por fecha y luego id descendentes, filtros todas, `sin-asignar` y `anuladas`, búsqueda por nombre del donante sin tildes ni comodines, sin contacto) y `getDonacion(id)` (detalle, pareja, proyectos activos con ítems y razones de solo lectura) a `lib/private-queries-core.ts` y exportarlas desde `lib/private-queries.ts`; verificar con `npx tsc --noEmit` y que `tests/private-access.test.ts` sigue pasando
- [x] 3.2 Escribir `tests/donaciones-lista.test.ts`: orden por fecha e id, filtro de sin asignar (excluye anuladas), filtro de anuladas, búsqueda "perez" encuentra "Ana Pérez", `%` y `_` como texto, límite de 100 con aviso, sin contacto en ningún resultado, `getDonacion` con pareja, anulada y proyecto finalizado como solo lectura, id inexistente o inválido devuelve `null`, y rechazo a un responsable desactivado; verificar que `npm run db:test` las pasa

## 4. Escrituras

- [x] 4.1 Crear `lib/donaciones-correcciones.ts` con `editarDonacion`: bloqueo de la donación con `for update` y de los proyectos implicados con `for share` en orden de id, rechazo de anuladas y de proyecto actual finalizado, tipo y donante tomados de la fila, reglas compartidas, sin cambios, duplicados con `excluirId`, y historial `editar` con valores antes y después sin datos personales; verificar con `npx tsc --noEmit`
- [x] 4.2 Añadir `asignarDonacion` (solo sin proyecto, proyecto activo, ítem obligatorio en producto, borra la descripción, un solo historial `asignar` con la descripción anterior, duplicados) y `anularDonacion` (motivo obligatorio, bloqueos, rechazo de ya anulada y de proyecto finalizado, historial `anular` con el motivo, la pareja intacta); verificar con `npx tsc --noEmit`
- [x] 4.3 Escribir `tests/donaciones-correcciones.test.ts` para editar: monto, cantidad, medio, fecha, historial con antes y después, tipo y donante que no cambian aunque vengan en la entrada, sin cambios, medio obligatorio, fecha futura, ítem de otro proyecto, descripción obligatoria, reasignar a otro proyecto y a otro ítem, dejar sin asignar (dinero y producto con descripción), destino finalizado, anulada, proyecto actual finalizado, `registrado_por` intacto, duplicado con advertencia y confirmación, y que no se cuenta a sí misma; verificar que `npm run db:test` las pasa
- [x] 4.4 Escribir las pruebas de asignar y anular: asignar dinero y producto, borrado de la descripción con el historial que la conserva, ítem obligatorio, proyecto sin meta, proyecto finalizado, ya asignada, duplicado; anular con motivo válido, historial con motivo, fila conservada con sus valores, sin motivo y de 201 caracteres, doble anulación, proyecto finalizado, pareja intacta, que lo anulado no cuenta como duplicado ni se vincula (`registrarDonacion`), y que el historial no tiene nombre ni contacto; verificar que pasa
- [x] 4.5 Escribir las pruebas de concurrencia con conexión real y limpieza que libera la transacción abierta antes de borrar: una anulación abierta hace esperar a una edición, que se rechaza por anulada; un cierre de proyecto abierto hace esperar a una reasignación, que se rechaza por finalizado; verificar que pasan y que fallan con una variante sin `for update` de la donación y sin `for share` del proyecto (revertirlas)

## 5. Acciones y pantallas

- [x] 5.1 Crear `app/(privado)/donaciones/correcciones.ts` o ampliar `actions.ts` con `editarDonacionAccion`, `asignarDonacionAccion` y `anularDonacionAccion` usando `crearAccionPrivada()`, sin ninguna acción de borrado ni de restaurar, y ampliar `tests/donaciones-estructura.test.ts` para que falle ante `.delete(` o ante `anulada: false` escrito en un módulo de donaciones; verificar con `npx tsc --noEmit`
- [x] 5.2 Crear `/donaciones` (lista con filtros por enlace, búsqueda `GET`, anuladas distinguidas, aviso de más de 100 y enlace a "Registrar donación") y un enlace "Donaciones" en el panel; verificar con `npm run build` que la ruta es dinámica
- [x] 5.3 Crear `/donaciones/[id]` con el detalle, el formulario de edición, el de asignación (solo sin proyecto) y el de anulación con motivo, el enlace a la otra parte de una donación mixta, la advertencia con "Guardar de todos modos", y el modo de solo lectura con su razón para anuladas y proyectos finalizados, más una página de no encontrado; los formularios se envían a mano para no vaciarse ante un error; verificar con `npm run build` y `npx tsc --noEmit`
- [x] 5.4 Verificación manual en el navegador contra la rama de pruebas de Neon (nunca producción): con un responsable, donantes, un proyecto con ítem y otro finalizado de prueba, registrar una donación en dinero y una "Sin asignar", editar el monto, provocar un duplicado y confirmarlo, reasignar a otro proyecto, asignar la "Sin asignar", anular sin motivo (ver el error) y con motivo, comprobar que la anulada y la del proyecto finalizado son de solo lectura y revisar en la base que el historial no tiene nombre ni contacto; después borrar los datos de prueba; verificar que cada paso se comporta como indica la spec

## 6. Documentación e integración

- [x] 6.1 Añadir a `CLAUDE.md` una nota de corrección de donaciones: qué se edita y qué no (tipo y donante fijos), reasignar solo a proyectos activos, asignar en una operación, anulación con motivo en el historial y sin restaurar, donaciones de un proyecto finalizado de solo lectura (pregunta abierta), orden de bloqueos (donación `for update`, proyectos `for share` por id) y que las reglas viven en `lib/donaciones-reglas.ts`; verificar que coincide con el código
- [x] 6.2 Ejecutar `npm run build`, `npm run lint`, `npx tsc --noEmit` y `npm run db:test`; verificar código de salida 0 y que cada requisito de `donation-editing`, `donation-voiding` y `donation-list` tiene al menos una prueba o una verificación manual anotada
- [x] 6.3 Ejecutar `openspec validate corregir-donaciones --strict`; verificar que no reporta errores

## Workflow follow-up

- Pasar el cambio por el `code-reviewer` antes de archivar y archivarlo cuando se cumplan los requisitos de revisión del proyecto.
- #9 (avance y "falta en soles") usa `anulada = false` como filtro y debe quedar cubierto por una prueba que incluya donaciones editadas, reasignadas y anuladas; #10 (reporte) reutiliza `listarDonaciones`.
- Decidir con el PRD cómo corregir donaciones de un proyecto finalizado antes de usar datos reales (pregunta abierta).
