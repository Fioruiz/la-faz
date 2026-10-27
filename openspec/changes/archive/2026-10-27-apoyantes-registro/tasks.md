# Tasks

## 1. Esquemas y nombre público

- [x] 1.1 Mover `texto`, `textoOpcional`, `casilla` e `id` de `lib/proyectos-esquemas.ts` a `lib/esquemas-formulario.ts` e importarlos desde ambos módulos; verificar con `npx tsc --noEmit` y que `tests/proyectos-esquemas.test.ts` sigue pasando sin cambios
- [x] 1.2 Crear `lib/apoyantes-esquemas.ts` con los esquemas de crear y editar (nombre 1–100, contacto opcional hasta 200 con vacío a `null`, casillas de rol y de anonimato, regla de al menos un rol con el error en la clave `roles`, id del apoyante en editar); escribir `tests/apoyantes-esquemas.test.ts` con nombre vacío y de 101, contacto de 201 y de 200, vacío a `null`, ningún rol, un rol, dos roles, anonimato por defecto falso e id inválido; verificar que pasa
- [x] 1.3 Crear `lib/apoyantes-publico.ts` con `ANONIMO` y `nombrePublico({ nombre, anonimoPublico })`; escribir `tests/apoyantes-publico.test.ts`: anónimo devuelve "Anónimo" sin ninguna parte del nombre real, no anónimo devuelve el nombre, y la marca ausente cuenta como no anónimo; verificar que pasa

## 2. Lecturas privadas

- [x] 2.1 Añadir `listarApoyantes({ busqueda, rol })` (sin contacto, orden por nombre, búsqueda por contiene sin tildes ni mayúsculas con texto literal, filtro de rol `donante` o `voluntario` ignorando otros valores, primeras 200 y `hayMas`) y `getApoyante(id)` (con contacto y cantidades de donaciones e inscripciones, o `null`) a `lib/private-queries-core.ts` y exportarlas desde `lib/private-queries.ts`; verificar con `npx tsc --noEmit` y que `tests/private-access.test.ts` sigue pasando
- [x] 2.2 Escribir `tests/apoyantes-lecturas.test.ts` contra la rama de pruebas: búsqueda "perez" encuentra "Ana Pérez", búsqueda con `%`, `_` y comillas como texto literal, filtro de voluntarios incluye a quienes también son donantes, la lista no incluye el contacto, límite de 200 con `hayMas`, id inexistente o inválido devuelve `null`, `getApoyante` devuelve las cantidades, y las dos consultas rechazan a un responsable desactivado; verificar que `npm run db:test` las pasa

## 3. Escrituras de apoyantes

- [x] 3.1 Crear `lib/apoyantes-escrituras.ts` con `crearApoyante` y `editarApoyante` (bloqueo de la fila con `for update` al editar, sin cambios, apoyante inexistente, rechazo de quitar un rol con donaciones o inscripciones, e historial `crear` y `editar` con `valoresApoyante()`: nombre, roles, anonimato, `tieneContacto` y `contactoModificado`, nunca el contacto); verificar con `npx tsc --noEmit`
- [x] 3.2 Escribir `tests/apoyantes-escrituras.test.ts`: crear donante, voluntario y ambos, sin contacto guarda `null`, sin rol y datos inválidos sin historial, nombre repetido permitido, anonimato por defecto falso, edición con cambio de nombre (historial con antes y después), sin cambios, inexistente, quitar un rol con y sin registros asociados (con una donación y una inscripción creadas en la prueba), no quedar sin roles, y responsable desactivado sin escritura; verificar que `npm run db:test` las pasa
- [x] 3.3 Escribir las pruebas de privacidad: serializar toda la fila de `audit_log` de una creación con contacto "999 888 777" y comprobar que no lo contiene, edición solo del contacto (se guarda, `contactoModificado` verdadero, ni el valor anterior ni el nuevo en el historial), quitar el contacto (`tieneContacto` falso), cambiar la marca de anonimato queda en el historial, y un fallo de base (nombre con carácter que Postgres rechaza, llamando a `escribir` directamente) devuelve el mensaje genérico y el log no contiene nombre ni contacto; verificar que pasa
- [x] 3.4 Escribir la prueba de concurrencia con conexión real y limpieza propia: una transacción A inserta una donación del apoyante y sigue abierta; editar quitando el rol de donante debe esperar y, al confirmar A, rechazarse; verificar que pasa y que falla con una variante sin el `for update` (revertirla)

## 4. Acciones y pantallas

- [x] 4.1 Extraer `Campo`, `Mensajes` y `useCampos` de `app/(privado)/proyectos/formularios.tsx` a un archivo compartido de `app/(privado)/` y usarlos desde proyectos sin cambiar su comportamiento; verificar con `npm run build` y `npx tsc --noEmit`
- [x] 4.2 Crear `app/(privado)/apoyantes/actions.ts` con `crearApoyanteAccion` y `editarApoyanteAccion` usando `crearAccionPrivada()`, y el formulario de cliente (nombre, contacto, casillas de rol, casilla de anonimato con el texto de «Anónimo», error de `roles`); verificar con `npx tsc --noEmit` y que `tests/escritura-auditada-estructura.test.ts` sigue pasando
- [x] 4.3 Crear `/apoyantes` (formulario `GET` de búsqueda y rol, lista con roles y marca de anónimo sin contacto, aviso de más de 200 resultados), `/apoyantes/nuevo` y `/apoyantes/[id]` (edición, contacto, cantidades de donaciones e inscripciones y página de no encontrado), todas `force-dynamic` y sin importar la base; añadir `/apoyantes/:path*` al `matcher` de `proxy.ts` y su aserción en `tests/proxy.test.ts`, y un enlace "Apoyantes" en el panel; verificar con `npm run build` que las rutas aparecen como dinámicas y que las pruebas del proxy pasan
- [x] 4.4 Escribir `tests/apoyantes-estructura.test.ts`: ningún módulo ni acción de apoyantes usa `.delete(`, `lib/apoyantes-escrituras.ts` no pasa el contacto a `antes` ni `despues`, y el esquema solo admite los campos nombre, contacto, roles y anonimato; verificar que pasa y que falla al añadir temporalmente un `.delete(` (revertirlo)
- [x] 4.5 Verificación manual en el navegador contra la rama de pruebas de Neon (nunca producción): iniciar sesión con un responsable de prueba, crear un apoyante sin rol y ver el error, crear un donante con contacto y marcarlo anónimo, buscar con y sin tildes, filtrar por rol, editar solo el contacto, quitar un rol sin registros; luego comprobar en la base de pruebas que el historial no contiene el contacto y borrar los datos y el responsable de prueba; verificar que cada paso se comporta como indica la spec

## 5. Documentación e integración

- [x] 5.1 Añadir a `CLAUDE.md` una nota de apoyantes: datos mínimos (nombre, contacto, roles, anonimato), el contacto no va al historial ni a logs, "Anónimo" sale de `nombrePublico()` y las lecturas públicas de #12 deben usarlo, nombres no únicos, no se borran, y que **falta revisión legal** de la ley peruana de protección de datos personales; verificar que la nota coincide con el código
- [x] 5.2 Ejecutar `npm run build`, `npm run lint`, `npx tsc --noEmit` y `npm run db:test`; verificar código de salida 0 y que cada requisito de `supporter-registry` y `supporter-privacy` tiene al menos una prueba o una verificación manual anotada
- [x] 5.3 Ejecutar `openspec validate apoyantes-registro --strict`; verificar que no reporta errores

## Workflow follow-up

- Pasar el cambio por el `code-reviewer` antes de archivar y archivarlo cuando se cumplan los requisitos de revisión del proyecto.
- #7 (registrar donación) reutiliza `listarApoyantes()` para elegir donante y debe comprobar que el apoyante tenga el rol de donante; #12 debe usar `nombrePublico()` en `lib/public-queries.ts`; #13 añade el consentimiento y las inscripciones.
- Revisión legal de la protección de datos personales: pendiente antes de usar datos reales (#14).
