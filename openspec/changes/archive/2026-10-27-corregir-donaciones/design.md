# Design

## Context

Estado observado: `lib/donaciones-escrituras.ts` (#7) contiene `registrarDonacion` con sus reglas inline: fecha no futura en Lima, donante con rol (`for share`), proyecto activo (`for share`), producto asignado con ítem del proyecto, vínculo mixto y búsqueda de duplicados. `donaciones` guarda `anulada` pero no un motivo, y la base impone el `CHECK` de tres estados y la FK compuesta ítem–proyecto (ADR 0008). `crearAccionPrivada()` y la variante `advertencia` (#4, #7) ya existen. Las lecturas privadas (`crearConsultasPrivadas`) ya tienen `getDatosFormularioDonacion` y `getDonacionParaVincular`. No hay lista de donaciones ni pantalla de detalle. Las pruebas corren en serie contra la rama `test-esquema`, con el patrón de bloqueo verificado con conexión real y una mutación. Requisitos en `specs/`; decisiones del usuario en `proposal.md`.

## Goals / Non-Goals

**Goals:**
- Corregir una donación sin poder dejarla en un estado que el registro no permitiría, ni cruzarse con una anulación o un cierre de proyecto simultáneos.
- Que cada cambio quede en el historial sin datos personales del donante, y que la anulación nunca borre.
- Una lista y un detalle mínimos para llegar a una donación.

**Non-Goals:**
- Totales, reporte por responsable y proyecto (#10), avance (#9), páginas públicas.
- Restaurar anuladas, cambiar el tipo o el donante, borrar, migraciones.
- Reabrir un proyecto finalizado para corregir sus donaciones (pregunta abierta).

## Decisions

**1. Reglas compartidas en `lib/donaciones-reglas.ts`.**
Se extraen de `registrarDonacion` funciones puras sobre la transacción: `exigirFechaNoFutura(fecha, ahora)`, `resolverProyectoEItem(tx, { proyectoId, tipo, itemId })` (lee el proyecto con `for share`, exige activo, meta e ítem del proyecto, y devuelve `{ proyecto, itemId }`), `buscarDuplicados(tx, candidata, excluirId?)` y `mensajeDuplicado(...)`. `registrarDonacion` pasa a usarlas sin cambiar su comportamiento (las 28 pruebas de #7 lo comprueban); `editarDonacion` y `asignarDonacion` las reutilizan, así que una regla nueva se cambia en un solo sitio. `buscarDuplicados` recibe `excluirId` para que una edición no se cuente a sí misma. Alternativa descartada: copiar las reglas en cada escritura, que garantiza que divergen.

**2. Cuatro escrituras: `editarDonacion`, `asignarDonacion`, `anularDonacion` (y `registrar` ya existente).**
Todas con `definirEscritura`, `crearAccionPrivada()` y sin borrado.
- **`editarDonacion`** `{ donacionId, proyectoId, itemId?, descripcionProducto?, monto?, medio?, cantidad?, fecha, confirmarDuplicado }`. No recibe tipo ni donante: salen de la fila. El esquema depende del tipo, que solo se conoce al leer la fila, así que valida lo común con Zod y los campos por tipo dentro de la escritura con el mismo `registrarDonacionEsquema` (se reutiliza armando la entrada con el tipo y el donante de la fila) en lugar de duplicar reglas. Como esa validación ocurre dentro de `escribir`, el núcleo gana `ValidacionError(errores)`, que el ejecutor devuelve como un resultado de validación por campo (con lo escrito) y revierte. Por eso los esquemas de editar y asignar solo exigen `donacionId` y dejan pasar el resto.
- **`asignarDonacion`** `{ donacionId, proyectoId, itemId?, confirmarDuplicado }`: solo para donaciones sin proyecto; cambia proyecto (y, en producto, ítem), borra `descripcion_producto` y escribe una sola fila de historial con acción `asignar`.
- **`anularDonacion`** `{ donacionId, motivo }`: motivo 1–200 recortado; pone `anulada = true`.

**3. Orden de bloqueos para no interbloquear.**
Primero la donación con `select ... for update`; luego los proyectos implicados (el actual y el de destino) con `for share`, **siempre ordenados por id ascendente**. Así dos escrituras que toquen los mismos proyectos los toman en el mismo orden. Registrar (#7) bloquea donante y proyecto con `for share` y, si vincula, la otra donación con `for update`; editar no toca al donante, así que no hay ciclo. Todas las comprobaciones de estado (anulada, proyecto finalizado) se hacen **después** de tener los bloqueos, para ver el estado vigente. Pruebas con conexión real, con limpieza que libera la transacción abierta primero, comprueban la anulación simultánea y el cierre simultáneo y detectan la variante sin bloqueo.

**4. Qué es "proyecto finalizado" para una donación.**
Una donación cuyo proyecto actual está finalizado es de solo lectura: no se edita, reasigna ni anula (coherente con #5, donde el proyecto y sus ítems no se editan y su resultado se escribió con esas cifras). Una donación "Sin asignar" no pertenece a ningún proyecto, así que sí se edita. El destino de una reasignación debe estar activo. Corregir una donación de un proyecto finalizado exigiría reabrirlo, que el PRD no contempla: pregunta abierta, no una función a medias.

**5. Edición: reasignar y dejar sin asignar.**
Editar acepta `proyectoId` con el mismo valor `sin-asignar` de #7. Pasar de proyecto a "Sin asignar" en un producto exige descripción (el `CHECK` lo exige); de "Sin asignar" a un proyecto en un producto exige ítem y borra la descripción. La FK compuesta y el `CHECK` siguen siendo la red de seguridad. Si la edición no cambia nada, devuelve "No hay cambios para guardar" sin historial. El duplicado se evalúa con los valores nuevos y `excluirId`.

**6. Historial.**
`entidad: "donacion"`. Acciones: `editar` (valores antes y después de monto, medio, cantidad, proyecto, ítem, descripción y fecha), `asignar` (proyecto e ítem antes y después, y la descripción anterior) y `anular` (`anulada` antes y después y `motivo`). Todas incluyen el id del donante (de contexto) y `duplicadoConfirmado` cuando aplica, y ninguna nombre ni contacto. Se añade `"asignar"` y `"anular"` a `ACCIONES_AUDITORIA` solo si faltan (ya existen). `registrado_por` no cambia en ninguna.

**7. Lecturas: `listarDonaciones` y `getDonacion`.**
`listarDonaciones({ filtro, busqueda })` ejecuta `requerir()` y devuelve las 100 más recientes (orden `fecha` descendente y luego `id` descendente) con donante (nombre real; es zona privada), tipo, monto o cantidad, medio, proyecto, ítem, descripción, `anulada` y si tiene pareja. Filtro `sin-asignar` = sin proyecto y no anulada; `anuladas`; cualquier otro valor = todas. La búsqueda por nombre del donante se hace en memoria con la misma normalización sin tildes que `listarApoyantes`, por la misma razón (comodines de `ILIKE`); para filtrar sobre todas se cargan las filas con join de nombre y se corta a 100 después de filtrar. `getDonacion(id)` devuelve el detalle, la pareja, los proyectos activos con ítems para el formulario y las razones de solo lectura (`anulada`, `proyectoFinalizado`). Ninguna devuelve el contacto.

**8. Pantallas en `app/(privado)/donaciones/`.**
`/donaciones` (lista con filtros por enlace y búsqueda `GET`, sin JavaScript) y `/donaciones/[id]` (detalle + editar + asignar + anular, o solo lectura con la razón), `force-dynamic`, sin importar la base. Los formularios de cliente se envían a mano (como el de #7) para que no se vacíen ante un error o un aviso; la advertencia de duplicado ofrece "Guardar de todos modos". La lista enlaza a "Registrar donación" y el panel gana un enlace "Donaciones". `proxy.ts` ya cubre `/donaciones`. Tras anular o editar se muestra el resultado en la misma página.

**9. Pruebas.**
Contra la rama de pruebas, un caso por cada requisito de las tres specs: editar cada campo, historial con antes y después, tipo y donante fijos, sin cambios, reglas heredadas (medio, fecha, ítem, descripción), reasignar a otro proyecto o ítem y dejar sin asignar, destino finalizado, asignar dinero y producto, borrado de la descripción, proyecto sin meta, ya asignada, duplicados con `excluirId`, anuladas y proyecto finalizado como solo lectura, anulación con motivo válido e inválido, doble anulación, pareja intacta, que lo anulado no cuenta para duplicados ni para vincular, historial sin datos personales, responsable desactivado, lectura de lista y filtros, y dos pruebas de concurrencia. Las pantallas se verifican a mano contra la rama de pruebas.

## Risks / Trade-offs

- [No hay restaurar] → Una anulación equivocada se corrige registrando de nuevo (el monto y la fecha se copian a mano). Es lo que pide el PRD ("solo se anula"); se puede ofrecer "registrar una igual" más adelante.
- [Donaciones de un proyecto finalizado inmodificables] → Un error descubierto después del cierre no se puede corregir desde la interfaz. Se anota como pregunta abierta; la salida es decidir con el PRD si se reabren los proyectos.
- [Lista cargada en memoria para buscar] → Con cientos o pocos miles de donaciones es trivial; si crece, se pasa a consulta con índice.
- [El historial guarda valores económicos] → No son datos personales del donante; el nombre real del donante solo se lee en la zona privada.
- [Editar fecha o monto cambia totales que otros ya vieron] → Es inherente a corregir; el historial permite reconstruir qué cambió y quién.
- [La edición y el registro comparten reglas pero no el mismo esquema Zod] → Se construye la entrada de edición con el tipo y el donante de la fila y se reutiliza el esquema de #7; una prueba comprueba que los mismos casos inválidos se rechazan igual en ambos.

## Migration Plan

No hay migración ni escritura en `production` al implementar. La reversión es revertir el commit; las ediciones, asignaciones y anulaciones hechas quedan en la base con su historial.

## Open Questions

- Qué hacer con un error descubierto en una donación de un proyecto finalizado (¿reabrir proyectos?): decisión del usuario con el PRD, en un cambio aparte.
- Si se quiere "registrar otra igual" tras anular: mejora de uso, fuera de este alcance.
