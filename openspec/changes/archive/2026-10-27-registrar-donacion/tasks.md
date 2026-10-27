# Tasks

## 1. Núcleo: advertencia y fecha de Lima

- [x] 1.1 Añadir `AdvertenciaError` y la variante `{ ok: false; tipo: "advertencia"; mensaje }` a `lib/escritura-auditada-core.ts`: el ejecutor la devuelve revirtiendo la transacción y sin registrarla en el log; ajustar `Mensajes` de `app/(privado)/formulario-comun.tsx` para tolerar el tipo nuevo; verificar con `npx tsc --noEmit`
- [x] 1.2 Escribir las pruebas de la advertencia en `tests/escritura-auditada.test.ts`: una escritura que lanza `AdvertenciaError` devuelve `tipo: "advertencia"` con su mensaje, revierte el cambio ya aplicado, no llama a `console.error` y no deja historial; verificar que `npm run db:test` las pasa
- [x] 1.3 Crear `lib/fechas.ts` con `hoyEnLima(ahora)` y `esFechaValida(texto)` (formato `YYYY-MM-DD` y día real); escribir `tests/fechas.test.ts`: a las 21:00 de Lima (02:00 UTC del día siguiente) devuelve el día de Lima, a las 23:59 y a las 00:00 de Lima, y rechaza `2026-02-30`, `2026-13-01` y textos mal formados; verificar que pasa

## 2. Esquema de la donación

- [x] 2.1 Crear `lib/donaciones-esquemas.ts` con la unión por `tipo`: dinero (monto con punto o coma hasta 10 enteros y 2 decimales mayor que cero, medio obligatorio) y producto (cantidad entera 1–1.000.000, sin monto ni medio), campo `proyecto` con id o `sin-asignar` (vacío es error), `itemId` obligatorio en producto con proyecto, `descripcionProducto` 1–200 obligatoria en producto sin proyecto, `fecha`, `apoyanteId`, `donacionVinculadaId` opcional y `confirmarDuplicado`; verificar con `npx tsc --noEmit`
- [x] 2.2 Escribir `tests/donaciones-esquemas.test.ts` (sin base): monto "150", "150.5", "150,50" válidos; 0, negativo, tres decimales, texto y 10.000.000.000 inválidos; medio faltante en dinero; cantidad 0, decimal y 1.000.001; proyecto vacío; producto con proyecto sin ítem; producto sin asignar sin descripción y con 201 caracteres; un producto con medio o monto no los conserva; ids inválidos; verificar que pasa

## 3. Lecturas privadas

- [x] 3.1 Añadir `getDatosFormularioDonacion()` (donantes ordenados por nombre sin contacto, proyectos activos con sus ítems y si tienen meta, último proyecto activo del responsable y `hoy` en Lima) y `getDonacionParaVincular(id)` a `lib/private-queries-core.ts` y exportarlas desde `lib/private-queries.ts`; verificar con `npx tsc --noEmit` y que `tests/private-access.test.ts` sigue pasando
- [x] 3.2 Escribir `tests/donaciones-lecturas.test.ts`: solo apoyantes con rol de donante, sin contacto, proyectos finalizados excluidos, ítems por proyecto, proyecto por defecto con y sin donaciones previas y con el último proyecto ya finalizado, `getDonacionParaVincular` con un id inexistente o inválido y con una anulada, y rechazo de ambas lecturas a un responsable desactivado; verificar que `npm run db:test` las pasa

## 4. Escritura de la donación

- [x] 4.1 Crear `lib/donaciones-escrituras.ts` con `registrarDonacion`: lectura del apoyante con `for share` y rol de donante, lectura del proyecto con `for share` (activo, con meta si es producto asignado, ítem del proyecto), fecha no futura en Lima, validación de la donación vinculada, búsqueda de duplicados con `AdvertenciaError` salvo confirmación, inserción atribuida al responsable de la sesión e historial `crear` con `duplicadoConfirmado` y `donacionVinculadaId`, sin datos personales; verificar con `npx tsc --noEmit`
- [x] 4.2 Escribir `tests/donaciones-escrituras.test.ts` para los tres estados: dinero asignado, dinero sin asignar, dinero a proyecto sin meta, producto asignado, producto sin asignar con descripción, medio obligatorio en dinero y producto sin medio, ítem de otro proyecto, proyecto sin meta, proyecto finalizado, proyecto inexistente, donante sin rol, donante inexistente, fecha futura rechazada y pasada aceptada, atribución al responsable de la sesión, historial sin nombre ni contacto, responsable desactivado y cada rechazo sin historial; verificar que `npm run db:test` las pasa
- [x] 4.3 Escribir las pruebas de duplicados y de donación mixta: coincidencia en dinero con advertencia, confirmación que guarda y marca el historial, cambio de cualquiera de donante, monto, fecha o proyecto sin advertencia, dos sin asignar iguales, producto asignado igual, producto sin asignar con descripción en otra capitalización, distinto tipo sin advertencia, anulada sin advertencia, y el mensaje sin nombre del donante; vinculada válida con historial, otro donante, mismo tipo, anulada, inexistente, ya vinculada en ambos sentidos, y partes en proyectos distintos o sin asignar; verificar que pasa
- [x] 4.4 Escribir las dos pruebas de concurrencia con conexión real y limpieza propia que libera la transacción abierta antes de borrar: una transacción que finaliza el proyecto y sigue abierta hace esperar al registro y este se rechaza por finalizado, y una que quita el rol de donante hace esperar al registro y este se rechaza por falta del rol; verificar que pasan y que fallan con una variante sin `for share` (revertirla)

## 5. Acción y pantalla

- [x] 5.1 Crear `app/(privado)/donaciones/actions.ts` con `registrarDonacionAccion` usando `crearAccionPrivada()` y la prueba estructural `tests/donaciones-estructura.test.ts` (ningún módulo de donaciones elimina filas, el esquema no lee `anulada` ni `registradoPor` de la entrada y la acción usa el patrón); verificar con `npx tsc --noEmit` y que las pruebas estructurales existentes siguen pasando
- [x] 5.2 Crear `/donaciones/nueva` (página `force-dynamic` y formulario de cliente): tipo, donante con filtro y enlace "Nuevo apoyante" en otra pestaña, proyecto con "Sin asignar" y el último usado preseleccionado, campos que cambian según tipo y proyecto, fecha de hoy en Lima, errores por campo conservando lo escrito, mensaje de regla, advertencia con "Guardar de todos modos" y confirmación con enlaces; verificar con `npm run build` que la ruta es dinámica
- [x] 5.3 Implementar el segundo paso de la donación mixta: `?vinculada=<id>` precarga donante fijo, tipo opuesto, fecha y proyecto, y la confirmación ofrece "Registrar la otra parte" solo si la donación no está ya vinculada; añadir `/donaciones/:path*` al `matcher` de `proxy.ts` y su aserción en `tests/proxy.test.ts`, y un enlace "Registrar donación" en el panel; verificar con `npm run build` y las pruebas del proxy
- [x] 5.4 Verificación manual en el navegador contra la rama de pruebas de Neon (nunca producción): con un responsable, un donante y un proyecto con ítem de prueba, registrar dinero por Yape, un producto asignado y un producto sin asignar, provocar el error de medio faltante conservando lo escrito, provocar el aviso de duplicado y confirmarlo, registrar la otra parte de una donación mixta, comprobar que un proyecto finalizado no aparece, medir cuánto tarda un registro completo (objetivo: menos de 2 minutos) y revisar en la base que el historial no tiene nombre ni contacto; después borrar los datos de prueba; verificar que cada paso se comporta como indica la spec

## 6. Documentación e integración

- [x] 6.1 Añadir a `CLAUDE.md` una nota de donaciones: tipos y reglas (medio obligatorio en dinero, producto asignado con ítem del proyecto, sin asignar con descripción), bloqueo `for share` del donante y del proyecto, aviso blando de duplicados con la variante `advertencia`, donación mixta (la segunda apunta a la primera), fecha en America/Lima, historial sin datos personales y que editar, anular y asignar son #8; verificar que coincide con el código
- [x] 6.2 Ejecutar `npm run build`, `npm run lint`, `npx tsc --noEmit` y `npm run db:test`; verificar código de salida 0 y que cada requisito de `donation-registration`, `duplicate-warning` y `mixed-donation` tiene al menos una prueba o una verificación manual anotada
- [x] 6.3 Ejecutar `openspec validate registrar-donacion --strict`; verificar que no reporta errores

## Workflow follow-up

- Pasar el cambio por el `code-reviewer` antes de archivar y archivarlo cuando se cumplan los requisitos de revisión del proyecto.
- #8 (editar, anular y asignar) debe reutilizar las reglas de este cambio (proyecto activo, ítem del proyecto, rol de donante) y es urgente porque hasta entonces un error de registro no se puede corregir desde la interfaz.
- #9 usa las donaciones en producto no anuladas para el avance; #10 las lista; #12 decide si el dinero avanza la barra pública.
