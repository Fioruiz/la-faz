# Tasks

## 1. Tipos, errores y registro de historial

- [x] 1.1 Crear `lib/escritura-auditada-core.ts` con `ACCIONES_AUDITORIA`, el tipo `RegistroAuditoria`, `ReglaDeNegocioError`, el tipo `ResultadoAccion<T>` (éxito, validación, regla, error) y `registrarAuditoria(tx, responsableId, registro)`, que inserta una fila en `audit_log`; verificar con `npx tsc --noEmit`
- [x] 1.2 Escribir `tests/escritura-auditada.test.ts` para `registrarAuditoria` contra la rama de pruebas: creación (antes nulo, después con valores), edición (antes y después), fecha puesta por la base, responsable atribuido, y rechazo de valores no serializables, de una acción fuera de la lista y de un `entidadId` no entero; verificar que `npm run db:test` las pasa

## 2. Ejecutor de escrituras auditadas

- [x] 2.1 Implementar `ejecutarEscrituraAuditada()` en el núcleo con el orden fijo: responsable activo, validación con Zod, transacción, `escribir`, filas de historial y confirmación; el caso de responsable no activo devuelve `no_autorizado` sin validar ni escribir; verificar con `npx tsc --noEmit`
- [x] 2.2 Escribir las pruebas de transacción con acciones de ejemplo sobre `proyectos`: éxito deja cambio e historial, falla del cambio no deja nada, falla del historial (un `entidadId` que Postgres rechaza después de aplicar el cambio) revierte el cambio, historial vacío o ausente revierte y devuelve error, varios registros quedan todos, y el historial se atribuye al responsable de la sesión aunque la entrada traiga otro id; verificar que `npm run db:test` las pasa y que una variante del ejecutor que abre la transacción después de escribir hace fallar la prueba de reversión
- [x] 2.3 Escribir las pruebas de responsable y entrada: desactivado con sesión vigente no valida ni escribe, id inexistente no escribe, entrada inválida no escribe, y `escribir` recibe los datos ya validados y tipados; verificar que `npm run db:test` las pasa

## 3. Resultados de la acción

- [x] 3.1 Implementar el mapeo de errores en el ejecutor: validación con mensajes por campo (`z.flattenError`) y `valores` de lo escrito sin los `camposSensibles`, `ReglaDeNegocioError` a `tipo: "regla"` con su mensaje y rollback, y cualquier otro error a un mensaje genérico fijo con log que solo lleva nombre del error, SQLSTATE y nombre de la acción; verificar con `npx tsc --noEmit`
- [x] 3.2 Escribir las pruebas de resultados: validación con un campo inválido conserva los valores de todos los campos, el campo sensible no vuelve, la regla de negocio a mitad de escritura revierte el cambio y devuelve su mensaje, un error de base devuelve el mensaje genérico sin texto de Postgres, y el log capturado no contiene la entrada ni la cadena de conexión; verificar que `npm run db:test` las pasa

## 4. Capa con Next y plantilla

- [x] 4.1 Crear `lib/escritura-auditada.ts` (con `import "server-only"`) con `crearAccionPrivada()`: usa `getDb()` y `requireResponsableActivo()`, devuelve una función `(estadoPrevio, formData)` para `useActionState` y llama a `redirect("/login")` fuera del `try/catch` cuando el núcleo informa `no_autorizado`; incluir en el encabezado un ejemplo comentado de cómo escribir una acción nueva; verificar con `npx tsc --noEmit` y `npm run build`
- [x] 4.2 Escribir `tests/escritura-auditada-estructura.test.ts` que falla si un archivo con `"use server"` bajo `app/(privado)/` no importa `lib/escritura-auditada`, salvo la lista de excepciones que no escriben en la base (`cerrarSesion`), y si `lib/escritura-auditada.ts` no tiene `server-only`; verificar que pasa y que falla al añadir temporalmente una acción de prueba sin el patrón (revertirla)

## 5. Documentación e integración

- [x] 5.1 Actualizar `CLAUDE.md` con una nota del patrón: toda escritura privada usa `crearAccionPrivada()`, declara su historial, usa `ReglaDeNegocioError` para rechazar, y el historial guarda solo los valores que la acción declara; verificar que la nota coincide con el código y no contiene valores reales
- [x] 5.2 Ejecutar `npm run build`, `npm run lint`, `npx tsc --noEmit` y `npm run db:test`; verificar código de salida 0 y que cada requisito de `audited-writes` y `action-results` tiene al menos una prueba que lo cubre
- [x] 5.3 Ejecutar `openspec validate escritura-auditada --strict`; verificar que no reporta errores

## Workflow follow-up

- Pasar el cambio por el `code-reviewer` antes de archivar y archivarlo cuando se cumplan los requisitos de revisión del proyecto.
- Los ítems #5, #6, #7 y #8 reutilizan `crearAccionPrivada()`; cada uno añade su acción a `ACCIONES_AUDITORIA` si hace falta.
- El contenido de las instantáneas de datos personales en `audit_log` lo fija el ítem #6 (A8).
