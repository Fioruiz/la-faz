# Design

## Context

Estado observado: `donaciones` existe desde #2 con `apoyante_id`, `proyecto_id` (nulo = sin asignar), `tipo`, `monto` (`numeric(12,2)`), `item_id`, `cantidad`, `descripcion_producto`, `medio`, `fecha` (`date`), `registrado_por`, `anulada`, `donacion_vinculada_id` (autorreferencia) y `creado_en`. La base impone la FK compuesta `(item_id, proyecto_id) → items_meta(id, proyecto_id)`, el `CHECK` de tres estados (ADR 0008) y los valores de `tipo` y `medio`, pero **no** exige `medio` en dinero (el `CHECK` de medio deja pasar `NULL`) ni impide `monto` en un producto sin asignar. Ya existen `crearAccionPrivada()` y `ejecutarEscrituraAuditada()` (#4), las escrituras de proyectos con `select ... for update` (#5) y de apoyantes (#6, que anotó que #7 debe comprobar el rol de donante). El resultado de las acciones aún no tiene una variante para "pedir confirmación". Las pruebas corren en serie contra la rama `test-esquema`, con el patrón de bloqueo verificado con conexión real. Requisitos en `specs/`; decisiones del usuario en `proposal.md`.

## Goals / Non-Goals

**Goals:**
- Registrar en una pantalla, rápido y sin poder dejar registros incoherentes aunque otra persona edite el proyecto o el donante a la vez.
- Que el aviso de duplicados sea un aviso, no un bloqueo, y que no filtre datos personales.
- Dejar la donación mixta y el "Sin asignar" listos para #8 (editar, anular y asignar) y #9 (avance).

**Non-Goals:**
- Editar, anular o asignar una donación existente (#8), lista o reporte (#10), avance (#9).
- Alta rápida del donante, pagos o cobros, recibos, migraciones o restricciones nuevas en la base.
- Detectar apoyantes repetidos o donantes anónimos duplicados (A6 parcial) y la zona horaria global (#14).

## Decisions

**1. Una sola escritura con un esquema que cubre los tres estados: `lib/donaciones-esquemas.ts` y `lib/donaciones-escrituras.ts`.**
`registrarDonacion` es un par `{ esquema, escribir }` creado con `definirEscritura`, igual que proyectos y apoyantes. El esquema es una unión discriminada por `tipo` (`dinero` | `producto`): dinero exige `monto` y `medio`; producto exige `cantidad` y no admite `monto` ni `medio`. El campo `proyecto` del formulario acepta un id o el valor `sin-asignar` (que pasa a `proyectoId = null`) y vacío es un error ("Elige un proyecto o Sin asignar"). En producto, con proyecto se exige `itemId`; sin proyecto se exige `descripcionProducto` (1–200). Campos comunes: `apoyanteId`, `fecha`, `donacionVinculadaId` opcional y `confirmarDuplicado` (casilla). Alternativa descartada: dos acciones (dinero y producto), que duplicaría la comprobación de donante, proyecto, fecha y duplicados.

**2. Validación Zod.**
- `monto`: acepta `150`, `150.5`, `150,50`; regex `^\d{1,10}([.,]\d{1,2})?$`, mayor que cero, normalizado a punto con dos decimales (reutiliza la idea de `costoReferencial`).
- `cantidad`: entero entre 1 y 1.000.000.
- `medio`: `yape | plin | transferencia`, obligatorio solo en dinero (decisión del usuario; sin migración).
- `fecha`: `YYYY-MM-DD` real (rechaza `2026-02-30`), no posterior a hoy en America/Lima y no anterior a 2020-01-01 (cota de cordura). La comprobación de "futura" vive en la escritura, que recibe el reloj, para poder probarla.
- Texto: `descripcionProducto` 1–200 recortado.
- Ningún campo de estado (`anulada`, `registradoPor`) se lee de la entrada.

**3. Fecha en America/Lima: `lib/fechas.ts`.**
`hoyEnLima(ahora = new Date())` devuelve `YYYY-MM-DD` con `Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" })`. Lima no tiene horario de verano, así que el desfase es fijo (UTC-5). Se usa para el valor por defecto y para rechazar fechas futuras. Una prueba cubre las 21:00 en Lima (ya es el día siguiente en UTC). La zona horaria del resto del sistema sigue siendo de #14.

**4. Orden de la escritura y bloqueos.**
Dentro de la transacción: (1) leer el apoyante con `select ... for share` y exigir que exista y tenga `es_donante`; (2) si hay proyecto, leerlo con `for share` y exigir que exista, esté activo y, si es producto asignado, tenga meta y el ítem pertenezca a él; (3) validar la donación vinculada si viene; (4) buscar duplicados; (5) insertar y declarar el historial. `FOR SHARE` es lo justo: bloquea las escrituras que usan `FOR UPDATE` (editar roles del apoyante en #6, finalizar o editar el proyecto en #5), de modo que o bien esas terminan antes y esta ve el estado nuevo, o bien esta termina antes y ellas esperan; y permite que dos registros simultáneos del mismo proyecto o donante no se bloqueen entre sí. El orden fijo (apoyante, luego proyecto) evita interbloqueos con las demás escrituras, que bloquean una sola fila. Dos pruebas con conexión real, como en #5 y #6, comprueban el cierre simultáneo y la edición de roles simultánea, y detectan la variante sin el bloqueo.

**5. Reglas de negocio y mensajes.**
Con `ReglaDeNegocioError`: "No se encontró al donante", "Esta persona no es donante", "No se encontró el proyecto", "Este proyecto ya está finalizado", "Este proyecto no tiene meta; registra el producto como Sin asignar o crea antes el ítem", "El ítem no pertenece al proyecto elegido", "La fecha no puede ser futura". La FK compuesta de la base sigue siendo la red de seguridad del par ítem–proyecto.

**6. Aviso de duplicados: `AdvertenciaError` y variante `advertencia`.**
Se añade a `lib/escritura-auditada-core.ts` la clase `AdvertenciaError(mensaje)` y la variante `{ ok: false; tipo: "advertencia"; mensaje: string }` de `ResultadoAccion`. El ejecutor la mapea sin registrarla como error (no va al log) y revierte, igual que una regla. La escritura busca donaciones no anuladas con el mismo `apoyante_id`, `tipo`, `fecha` y `proyecto_id` (comparando `NULL` con `IS NOT DISTINCT FROM`) y, según el tipo, el mismo `monto`, o la misma `cantidad` y el mismo `item_id` (o la misma descripción sin distinguir mayúsculas ni tildes cuando no hay ítem). Si hay coincidencias y no vino `confirmarDuplicado`, lanza `AdvertenciaError` con un mensaje del tipo "Ya hay 1 donación igual (producto, 2026-11-03, 10 Derechos). ¿Guardar de todos modos?", sin nombre ni contacto del donante. Si vino confirmada, guarda y el historial lleva `duplicadoConfirmado: true`. No hay restricción única (ADR 0006) y la comprobación no es atómica: dos registros simultáneos pueden pasar ambos. Alternativa descartada: pedir confirmación en el cliente antes de enviar, que obligaría a otra consulta y no protegería a otro responsable que registre lo mismo.

**7. Donación mixta: vínculo de la segunda a la primera.**
La segunda donación guarda `donacion_vinculada_id` apuntando a la primera. La escritura lee la vinculada y exige: que exista, que no esté anulada, que sea del mismo apoyante, que sea de tipo distinto y que no tenga ya vinculada ni sea apuntada por otra donación. El segundo paso del formulario recibe `?vinculada=<id>` en la URL, lee esa donación por el acceso privado y precarga donante (fijo), tipo opuesto, fecha y proyecto. Si la vinculada no sirve (no existe, otro tipo no aplicable), muestra el formulario normal con un aviso. Alternativa descartada: un formulario único con las dos partes, que complica el esquema, la validación y el aviso de duplicados para el caso menos frecuente.

**8. Lecturas del formulario en `crearConsultasPrivadas`.**
`getDatosFormularioDonacion()` devuelve, tras `requerir()`: los donantes (id, nombre y marca de anónimo, sin contacto, ordenados por nombre), los proyectos activos con sus ítems (nombre, unidad, id) y si tienen meta, el proyecto por defecto (el de la última donación asignada de ese responsable, consultando `donaciones.registrado_por` por id descendente, solo si sigue activo) y `hoy` en Lima. `getDonacionParaVincular(id)` devuelve lo mínimo de la donación (tipo, apoyante, fecha, proyecto) o `null`. Todos los donantes se cargan de una vez (se asume cientos, no decenas de miles).

**9. Formulario: `app/(privado)/donaciones/nueva/`.**
Una página `force-dynamic` y un formulario de cliente con `useActionState`. Muestra u oculta campos según `tipo` y proyecto: dinero (monto, medio), producto con proyecto (ítem, cantidad), producto sin asignar (descripción, cantidad). El donante se elige con un campo de filtro que reduce las opciones de la lista (en el cliente) y un enlace "Nuevo apoyante" que abre `/apoyantes/nuevo` en otra pestaña. Cuando el resultado es `advertencia`, se muestra el mensaje y un botón "Guardar de todos modos" que reenvía el mismo formulario con `confirmarDuplicado`. Tras un éxito se muestra una confirmación con el resumen y los enlaces "Registrar otra", "Registrar la otra parte" (si no es ya la segunda parte) y "Panel". Se conserva lo escrito ante un error (`valores`). El panel gana un enlace y `proxy.ts` cubre `/donaciones`.

**10. Historial.**
`entidad: "donacion"`, acción `crear`, `antes: null` y `despues` con `tipo`, `monto`, `medio`, `proyectoId`, `itemId`, `cantidad`, `descripcionProducto`, `fecha`, `apoyanteId`, `donacionVinculadaId` y `duplicadoConfirmado`. Guarda el id del donante, no su nombre ni su contacto (decisión de #6: el historial no copia datos personales).

**11. Pruebas.**
Contra la rama de pruebas, un caso por cada requisito de las tres specs: los tres estados, medio obligatorio, monto y cantidad inválidos, proyecto finalizado o sin meta, ítem de otro proyecto, descripción obligatoria, donante sin rol o inexistente, fecha por defecto, futura y pasada, proyecto por defecto, duplicados en dinero, producto asignado y sin asignar (incluidas anuladas y tipos distintos), confirmación, historial sin datos personales, vinculada válida y cada rechazo, atribución, responsable desactivado, y dos pruebas de concurrencia con conexión real y limpieza propia. El formulario se verifica a mano en el navegador contra la rama de pruebas, incluido el tiempo para completar un registro.

## Risks / Trade-offs

- [El aviso no es atómico] → Dos responsables que registran lo mismo a la vez pueden pasar ambos; aceptado en el ADR 0006. La confirmación tampoco impide un duplicado real.
- [Sin pantalla para ver ni corregir lo registrado hasta #8 y #10] → Si el responsable se equivoca de monto o de proyecto, no puede corregirlo desde la interfaz hasta #8. Se mitiga con la confirmación del resumen tras guardar; hay que implementar #8 pronto.
- [Cargar todos los donantes en el formulario] → Con cientos es trivial; con miles el `select` sería pesado. Se revisa si el volumen crece.
- [Donantes con el mismo nombre en la lista] → Se muestran por nombre y la marca de anónimo; no hay otro dato para distinguirlos (el contacto no se muestra por minimización). El responsable puede abrir el detalle del apoyante.
- [Dinero sin proyecto no suma a ningún total] → Es lo que pide el PRD; hasta que se asigne (#8) no cuenta en ninguna barra ni total.
- [Fecha en Lima calculada en la aplicación] → Correcta mientras Lima no use horario de verano; el resto del sistema sigue en UTC hasta #14, lo que puede confundir en los reportes de #10.
- [La base no exige `medio` en dinero] → Solo la acción lo garantiza; una escritura directa en la consola de Neon podría omitirlo. Se acepta (decisión del usuario, sin migración).

## Migration Plan

No hay migración ni escritura en `production` al implementar. Tras desplegar, el responsable registra las donaciones desde la interfaz. La reversión es revertir el commit; las donaciones registradas quedan en la base.

## Open Questions

- Si el dinero debe avanzar la barra pública (decisión abierta de C3): corresponde a #12 y no afecta este diseño.
- Si hará falta un alta rápida de donante dentro del formulario: el usuario decidió no incluirla ahora; si el uso real lo pide, es un cambio aparte.
