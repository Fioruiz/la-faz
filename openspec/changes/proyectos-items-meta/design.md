# Design

## Context

Estado observado: `proyectos` (`nombre` único, `descripcion`, `tiene_meta`, `estado` con `CHECK` `activo|finalizado`, `resultado`) e `items_meta` (`proyecto_id`, `nombre`, `unidad`, `cantidad_meta > 0`, `costo_referencial` `numeric(12,2)` nulo o positivo) existen desde #2. La base no impide que un proyecto `finalizado` no tenga resultado, que un proyecto sin meta tenga ítems ni que dos ítems de un proyecto se llamen igual; esas reglas viven en la aplicación y no se cambia el esquema. `producción` tiene los 4 proyectos iniciales y ningún ítem. Ya existen `crearAccionPrivada()` y el ejecutor (#4), que exigen un esquema Zod, devuelven `ResultadoAccion` y obligan a declarar el historial; `crearConsultasPrivadas(requerir)` (#3) solo tiene `getPanel` y no recibe la base. Las pruebas usan la rama `test-esquema`, `enTransaccion()` y el patrón de núcleo sin Next más capa con Next. Las páginas privadas llevan `force-dynamic` y no importan la base ni el esquema (ADR 0005, 0009). Requisitos en `specs/`; motivación en `proposal.md`.

## Goals / Non-Goals

**Goals:**
- Que un responsable defina las metas de una campaña (proyecto, ítems, costo) y la cierre, con pantallas mínimas y sin tocar SQL.
- Que las reglas de coherencia (ítems solo en proyectos con meta, proyecto finalizado de solo lectura, nombres únicos) se cumplan aunque dos responsables actúen a la vez.
- Dejar una lectura privada de proyectos e ítems que #7 y #9 reutilizan.

**Non-Goals:**
- Avance, excedente, "falta en soles" y barras (#9, #12), registro de donaciones (#7), páginas públicas (#11).
- Borrar o reabrir proyectos e ítems, anular ítems, reordenar ítems.
- Cambios de esquema, migraciones y restricciones nuevas en la base.
- Diseño visual elaborado: son pantallas funcionales con Tailwind básico.

## Decisions

**1. Esquemas y lógica de escritura fuera de las acciones: `lib/proyectos-esquemas.ts` y `lib/proyectos-escrituras.ts`.**
Los archivos con `"use server"` solo pueden importar Next y `server-only`, y las pruebas no pueden cargar `crearAccionPrivada()`. Por eso cada escritura se define como un par `{ esquema, escribir }` sin Next, y `app/(privado)/proyectos/actions.ts` solo los pasa a `crearAccionPrivada({ nombre, esquema, escribir })`. Las pruebas ejecutan el mismo par con `ejecutarEscrituraAuditada()` contra la rama de pruebas, igual que se probó el patrón en #4. Alternativa descartada: escribir la lógica dentro de `actions.ts`, que no se puede probar sin levantar Next.

**2. Cinco escrituras: tres de proyecto y dos de ítem.**
`crearProyecto`, `editarProyecto`, `finalizarProyecto`, `crearItem` y `editarItem`. No hay escritura de borrado, a propósito (decisión 8). Cada una declara su historial con `entidad` `proyecto` o `item_meta` y las acciones `crear`, `editar` y `finalizar` (ya existen en `ACCIONES_AUDITORIA`). `antes` y `despues` llevan solo los campos de negocio (nombre, descripción, tiene meta, estado, resultado; nombre, unidad, meta y costo del ítem), sin fechas; el historial de un ítem incluye `proyectoId` porque `audit_log` no tiene columna de proyecto.

**3. Cada escritura bloquea la fila del proyecto: `select ... for update`.**
Lo primero dentro de la transacción de `escribir` es leer el proyecto con `.for("update")`. Así, finalizar y agregar o editar un ítem se serializan, y la regla "proyecto finalizado no recibe cambios" se evalúa sobre el estado vigente (S3). Alternativa descartada: confiar en la comprobación sin bloqueo, que permite crear un ítem justo mientras otro responsable finaliza el proyecto. Con ~3 usuarios no hay costo apreciable.

**4. Reglas de negocio con `ReglaDeNegocioError` y mensajes en español.**
Lanzadas desde `escribir`, revierten todo y llegan al formulario como `tipo: "regla"`:
- proyecto inexistente, o ítem que no pertenece al proyecto: "No se encontró el proyecto" / "No se encontró el ítem en este proyecto";
- proyecto finalizado: "Este proyecto ya está finalizado";
- crear ítem en proyecto sin meta: "Este proyecto no tiene meta";
- quitar la meta a un proyecto con ítems: "Un proyecto con ítems no puede quedar sin meta";
- nombre repetido: "Ya existe un proyecto con ese nombre" / "Ya existe un ítem con ese nombre en este proyecto";
- edición sin cambios: "No hay cambios para guardar".
La unicidad de nombre se comprueba con `lower(trim(nombre))` dentro de la transacción. Para proyectos, la restricción `UNIQUE` de la base es la red de seguridad contra una carrera: un error `23505` se traduce al mismo mensaje. Para ítems no hay restricción en la base; la serialización del punto 3 evita la carrera entre ítems del mismo proyecto.

**5. Validación Zod.**
- Texto: `trim()`; nombre de proyecto e ítem 1–100; descripción 0–1000 (vacía pasa a `null`); unidad 1–30; resultado 1–2000.
- `cantidadMeta`: entero entre 1 y 1.000.000 (`z.coerce.number().int()`), de modo que respete el `integer` de la base y el `CHECK` `> 0`.
- `costoReferencial`: opcional; acepta "13", "13.5" y "13,50" (regex `^\d{1,7}([.,]\d{1,2})?$` tras recortar), lo normaliza a punto decimal y lo guarda como texto para `numeric`; vacío pasa a `null`; cero o negativo se rechaza antes de llegar al `CHECK`. Es costo por **una unidad del ítem** (el ítem "Pack de agua x24" con unidad "pack" y costo 13 representa "24 botellas = S/ 13").
- `tieneMeta`: casilla del formulario (`"on"` o ausente) a booleano.
- Los ids vienen de campos ocultos con `z.coerce.number().int().positive()`.
No se confía en ningún campo de estado que venga del formulario: el estado lo decide `escribir`.

**6. Lecturas: `crearConsultasPrivadas(requerir, obtenerDb)` gana la base (como función, para no exigir `DATABASE_URL` al importar) y dos consultas.**
`listarProyectos()` devuelve los proyectos con estado, si tienen meta y la cantidad de ítems; `getProyecto(id)` devuelve el proyecto con sus ítems ordenados por nombre, o `null`. Ambas ejecutan `requerir()` antes que nada y el id se valida antes de consultar. La lectura de la página privada usa `requireResponsableActivo` y `getDb()`; las pruebas recorren todas las funciones con un responsable desactivado, como ya se hace (las funciones nuevas quedan cubiertas sin registrarlas). El cambio de firma obliga a ajustar los dos sitios que hoy llaman a la fábrica.

**7. Pantallas en `app/(privado)/proyectos/`, todas `force-dynamic` y sin importar la base.**
- `/proyectos`: lista con estado (Activo/Finalizado), si tiene meta y cantidad de ítems; botón "Nuevo proyecto".
- `/proyectos/nuevo`: formulario de proyecto nuevo.
- `/proyectos/[id]`: datos del proyecto con formulario de edición (si está activo), tabla de ítems con edición por fila (`<details>`) y formulario "Agregar ítem" (si tiene meta y está activo), y el formulario de finalización con el resultado. Un proyecto finalizado muestra el estado y el resultado y ningún formulario.
- El panel gana un enlace a Proyectos.
Los formularios son componentes de cliente con `useActionState` (como el login) que muestran `errores` por campo y reponen lo escrito con `valores` mediante `defaultValue` (React 19 vacía los campos tras cada acción). Tras crear un proyecto se navega a su página; tras editar o finalizar se refresca y se muestra "Cambios guardados". Una página de no encontrado cubre los ids inexistentes y los no numéricos. El `proxy.ts` pasa a cubrir también `/proyectos` (solo redirige al login; la comprobación real sigue en cada lectura y escritura).

**8. Sin borrado y sin reabrir, por el PRD.**
El PRD dice que nada se borra definitivamente y no menciona reabrir un proyecto; la regla del proyecto exige parar ante lo que el PRD no menciona. El esquema tampoco tiene anulación de ítems. Se deja fuera con un aviso en la propuesta, en vez de añadir un borrado o una columna nueva. Una prueba estructural comprueba que ninguna acción ni módulo de proyectos e ítems usa `.delete(`.

**9. Pruebas con `node:test` contra la rama de pruebas.**
Cada regla de los specs tiene un caso: creación, edición con y sin cambios, unicidad (mayúsculas y espacios), finalización (con y sin resultado, ya finalizado), solo lectura del finalizado, ítems (límites, costo con coma y punto, vacío a `null`, ítem de otro proyecto, proyecto sin meta o finalizado), historial por escritura, atribución, responsable desactivado y bloqueo de fila (dos escrituras concurrentes sobre el mismo proyecto, con conexión real y limpieza propia, como las pruebas de atomicidad de #4). Los formularios y pantallas se verifican a mano en el navegador contra la rama de pruebas, como se hizo con el login.

## Risks / Trade-offs

- [Sin reabrir ni borrar, un cierre o un ítem creado por error no tiene vuelta atrás] → Se corrige editando el ítem; para un cierre erróneo habría que ajustar la base a mano. Es el costo de no añadir funciones que el PRD no menciona; si el usuario las quiere, se actualiza el PRD primero y se hace en un cambio aparte.
- [Un proyecto con ítems queda con meta para siempre] → Consecuencia directa de no borrar ítems; se muestra un mensaje claro.
- [La base no impide un finalizado sin resultado ni un ítem en proyecto sin meta] → Solo las acciones escriben (prueba estructural de #4); una escritura directa en la consola de Neon podría romper estas reglas, igual que se aceptó en el ADR 0002 para el historial.
- [`select for update` serializa a los responsables sobre un mismo proyecto] → Es el comportamiento buscado; las transacciones son cortas.
- [Nombres únicos sin mayúsculas se comprueban en la aplicación, no con un índice] → La carrera entre dos proyectos nuevos con el mismo nombre en distinta capitalización queda sin cubrir (la restricción de la base solo cubre el nombre exacto); se acepta con ~3 usuarios.
- [Lo escrito se repone con `defaultValue` y depende del comportamiento de React 19] → Se verifica a mano en el navegador; si falla, se pasa a campos controlados.
- [Costo referencial por unidad puede confundirse con el costo del pack] → La etiqueta del formulario lo dice y el diseño lo documenta; #9 usa esa misma definición (ADR 0010).

## Migration Plan

No hay migración de esquema ni escritura en `production` durante la implementación. Tras desplegar, el responsable crea los ítems de "10 Derechos" y "Apoyo alimentario" desde la interfaz. La reversión es revertir el commit; los ítems creados quedan en la base y no los ve nadie más.

## Open Questions

- Si "Música" y "Casa del Buen Samaritano" deben poder pasar a tener meta: lo permite la regla actual (la casilla de meta es editable mientras no haya ítems). No cambia el diseño.
- Si hará falta reabrir o borrar: queda a decisión del usuario con el PRD, fuera de este cambio.
