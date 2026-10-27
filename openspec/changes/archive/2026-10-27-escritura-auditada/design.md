# Design

## Context

Estado observado: `requireResponsableActivo()` (`lib/private-access.ts`) y su núcleo `verificarResponsableActivo(db, id)` (`lib/responsable-activo.ts`) ya existen; `audit_log` ya está en `lib/schema.ts` con `entidad`, `entidad_id`, `accion`, `antes` y `despues` (`jsonb`), `responsable_id` (obligatorio) y `creado_en`, sin restricciones sobre `accion`. El proyecto sigue el patrón "núcleo sin Next + capa delgada con Next" (`private-queries-core.ts` y `private-queries.ts`), porque `server-only` impide importar los módulos en las pruebas bajo `tsx`. Las pruebas usan `node:test` contra la rama `test-esquema` y `enTransaccion()` (`tests/helpers.ts`), que ejecuta cada caso en una transacción que se revierte. Hoy las únicas Server Actions son `iniciarSesion` y `cerrarSesion`, que no escriben en tablas de negocio. No hay ninguna escritura de negocio todavía (llegan en #5 a #8).

Reglas heredadas: ADR 0003 (cada acción valida con Zod, comprueba al responsable y guarda cambio y `audit_log` en una transacción), ADR 0006 (errores de validación sin perder lo escrito, fallos de base con mensaje genérico y detalle en el log de Vercel, una sola transacción), ADR 0009 (la comprobación del responsable es la primera operación). Requisitos en `specs/`; motivación en `proposal.md`.

## Goals / Non-Goals

**Goals:**
- Que escribir en la zona privada sin historial, sin validar o sin comprobar al responsable sea difícil de hacer por descuido: el camino cómodo es el correcto.
- Que el patrón se pruebe una vez, contra Postgres real, y los ítems #5 a #8 solo prueben su lógica de negocio.
- Un resultado uniforme que la interfaz pueda mostrar sin conocer cada acción.

**Non-Goals:**
- Escribir cualquier acción de negocio o pantalla, o una pantalla del historial.
- Decidir qué datos personales entran al historial (#6, A8): el patrón guarda solo lo que cada acción declara.
- Reintentos automáticos, monitoreo o cola de errores (ADR 0006 los descarta).
- Concurrencia entre dos responsables que editan lo mismo (S3 sigue abierto).

## Decisions

**1. Un ejecutor, no una convención: `ejecutarEscrituraAuditada()` en `lib/escritura-auditada-core.ts`.**
Recibe un objeto con: `db` (con `transaction`), `requerir` (comprobación del responsable), `esquema` (Zod), `entrada` (los datos sin validar) y `escribir(tx, datos, responsable)`. Orden fijo: (1) `requerir()`; (2) validar con el esquema; (3) abrir la transacción; (4) ejecutar `escribir`; (5) insertar las filas de historial que `escribir` declaró; (6) confirmar. Un ejecutor, y no una plantilla para copiar, hace que el orden y la transacción no dependan de la disciplina de cada autor (el riesgo que ya nombran los ADR 0007 y 0009). Alternativa descartada: solo documentar el patrón y pegarlo en cada acción, porque cada copia puede divergir.

**2. `escribir` devuelve `{ datos, auditoria }` y `auditoria` es obligatoria.**
`auditoria` es una lista (una entrada por entidad modificada) de `{ entidad, entidadId, accion, antes, despues }`. Si la lista está vacía o falta, el ejecutor lanza un error interno y la transacción se revierte. `antes` es nulo en una creación; `despues` es nulo en un caso sin estado posterior. `responsable_id` nunca viene de la acción: lo pone el ejecutor con el responsable comprobado en el paso 1 (spec: "Atribución"). `creado_en` usa el valor por defecto de la base (`now()`). Alternativa descartada: que cada acción llame a un `registrarAuditoria()` suelto, porque se puede olvidar sin que nada falle. La función `registrarAuditoria(tx, ...)` existe, pero solo la usa el ejecutor.

**3. El historial guarda solo lo que la acción declara (ADR 0002, A8).**
No se copia ninguna fila automáticamente: `antes` y `despues` son los objetos que la acción pasa, para poder dejar fuera `password_hash` u otros datos sensibles. El ejecutor comprueba que sean serializables a JSON (`JSON.stringify` sin error y sin `undefined` en la raíz) y revierte si no. El contenido de las instantáneas de apoyantes lo decide #6 con el contexto de la ley peruana de protección de datos.

**4. `accion` es una lista cerrada en TypeScript, no en la base.**
`ACCIONES_AUDITORIA = ["crear", "editar", "anular", "asignar", "finalizar"] as const`. Las acciones futuras se añaden a la lista sin migrar, porque `audit_log.accion` es `text`. Alternativa descartada: un `CHECK` en la base, que obligaría a una migración por cada acción nueva y toca el esquema fuera del alcance.

**5. Transacción con el `db` recibido; en las pruebas es un savepoint.**
El ejecutor llama a `db.transaction(...)`. En producción, `db` es `getDb()` (driver con `Pool` y WebSocket, que ya soporta transacciones interactivas, A4). En las pruebas se pasa el `tx` de `enTransaccion()`, y Drizzle convierte la transacción interna en un savepoint: el caso se prueba con rollback real y se revierte al final. El tipo del parámetro es `Pick<..., "transaction">`.

**6. Resultado: unión discriminada `ResultadoAccion<T>`.**
```
{ ok: true, datos: T }
{ ok: false, tipo: "validacion", errores: Record<campo, string[]>, valores: Record<campo, string> }
{ ok: false, tipo: "regla", mensaje: string }
{ ok: false, tipo: "error", mensaje: string }
```
Un cuarto caso, `no_autorizado`, existe solo en el núcleo (lo devuelve cuando `requerir()` lanza `ResponsableNoActivoError`) y la capa con Next lo convierte en una redirección. Los errores de validación se agrupan por campo con `z.flattenError(...).fieldErrors`. `valores` reúne las entradas de texto de un `FormData` o de un objeto, menos las claves listadas en `camposSensibles` (por ejemplo, contraseñas), para que el formulario no pierda lo escrito (React 19 vacía los campos tras cada acción de formulario, como se vio al probar el login). Alternativa descartada: lanzar excepciones y capturarlas en cada formulario, porque `useActionState` espera un valor devuelto.

**7. Reglas de negocio con `ReglaDeNegocioError(mensaje)`.**
Las acciones lanzan `ReglaDeNegocioError("Este proyecto ya está finalizado")` desde `escribir`. El ejecutor revierte la transacción y devuelve `tipo: "regla"` con ese mensaje. Cualquier otro error es "inesperado". La clase vive en el núcleo y se documenta como la forma de rechazar en #5 (finalizar), #7 (proyecto finalizado) y #8.

**8. Errores inesperados: mensaje genérico y log mínimo.**
El mensaje al usuario es fijo ("No pudimos guardar los cambios. Intenta de nuevo en unos minutos."). El log recibe `console.error` con el nombre del error, el código SQLSTATE si existe y la identidad de la acción, pero **no** `error.message` completo ni la entrada, porque los mensajes de Postgres pueden incluir valores de la fila (datos personales) y los de conexión, la cadena. Así se cumple el ADR 0006 sin filtrar datos. Alternativa descartada: registrar el error completo, que es más cómodo para depurar pero puede escribir datos de donantes en el log de Vercel.

**9. Capa con Next: `crearAccionPrivada()` en `lib/escritura-auditada.ts` (con `server-only`).**
Une el núcleo con `getDb()`, `requireResponsableActivo()` y `redirect("/login")` cuando el núcleo informa `no_autorizado`. Devuelve una función `(estadoPrevio, formData) => Promise<ResultadoAccion<T>>` lista para `useActionState`. La redirección se hace fuera del `try/catch` del ejecutor para que `NEXT_REDIRECT` no se confunda con un error. Alternativa descartada: llamar a `redirect()` dentro del núcleo, que obligaría a probarlo con el runtime de Next.

**10. Plantilla de ejemplo como documentación y prueba, no como acción real.**
Un ejemplo comentado al inicio de `lib/escritura-auditada.ts` y una acción de ejemplo dentro de las pruebas (sobre `proyectos`, para tener una tabla real) muestran cómo escribir una acción nueva. No se añade ninguna acción de producción ni pantalla: lo manda el alcance del ítem. `CLAUDE.md` gana una nota con el patrón y la regla de que toda escritura privada lo usa.

**11. Verificación estructural de que las acciones usan el patrón.**
Una prueba lee los archivos con `"use server"` bajo `app/(privado)/` y falla si alguno no importa `lib/escritura-auditada`, salvo una lista explícita de excepciones que no escriben en la base (hoy, `cerrarSesion`). Es la comprobación mecánica del ADR 0003 ("olvidarla en una acción deja esa operación abierta"), la misma idea que `privado-estructura.test.ts` usa para el ADR 0009. Los módulos de `app/(privado)/` ya tienen prohibido importar la base y el esquema, así que una acción de escritura no tiene otra vía.

**12. Pruebas contra la rama de pruebas, sobre tablas reales.**
Los casos de transacción usan `proyectos` y `audit_log` (existentes) con acciones de ejemplo definidas en la prueba. Se cubren: éxito (cambio e historial), falla del cambio, falla del historial (por ejemplo, un `entidadId` que viola un `NOT NULL`, o una acción que lanza al declarar), historial vacío, varios registros, atribución al responsable de la sesión, valores no serializables, validación sin escritura, regla de negocio con rollback, error de base con mensaje genérico y log sin datos, responsable desactivado sin escritura, y campos sensibles fuera de `valores`.

## Risks / Trade-offs

- [Un autor nuevo escribe una acción sin el ejecutor] → La prueba estructural (decisión 11) y la revisión de código; no es una garantía mecánica total, porque una acción podría usar el ejecutor y llamar a otra vía de escritura dentro de `escribir`. El ejecutor entrega solo la transacción, que ya pasa por el historial obligatorio.
- [El historial declarado por la acción puede omitir un campo que cambió] → Se acepta: la garantía es que exista un registro por cada escritura, no que sea completo. Cada ítem prueba su propio `antes`/`despues`.
- [`valores` devuelve datos personales al navegador] → Solo lo que la misma persona escribió en ese formulario, de vuelta a esa persona, y sin los campos sensibles.
- [Sin `error.message` en el log, depurar es más lento] → Se conserva el nombre del error y su SQLSTATE, y se puede reproducir con la rama de pruebas. Es el costo de no filtrar datos personales.
- [Una transacción dentro de otra se vuelve savepoint en pruebas] → Es lo que se busca para poder revertir; el comportamiento transaccional es el mismo y se verifica con falla real.
- [Cambios futuros del contrato de `ResultadoAccion`] → Se amplía añadiendo variantes; las pantallas de #5 a #8 ya dependerán de él, por eso se fija ahora.

## Migration Plan

No hay migración de esquema ni escritura en `production`. Los cambios son solo de código y de pruebas. La reversión es revertir el commit. Los ítems #5 a #8 empiezan a usar el ejecutor cuando se implementen.

## Open Questions

- Si el aviso de duplicados de #7 (resultado "advertencia" que pide confirmar) se añade como una variante nueva de `ResultadoAccion`: se decide en #7 sin cambiar este diseño.
- Qué acciones de historial adicionales hacen falta (por ejemplo, "reactivar"): cada ítem añade la suya a `ACCIONES_AUDITORIA`.
