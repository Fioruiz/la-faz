# Design

## Context

Estado observado: `apoyantes` existe desde #2 con `nombre` (obligatorio), `contacto` (texto, opcional), `es_donante`, `es_voluntario`, `anonimo_publico` y un `CHECK` de que haya al menos un rol; `donaciones.apoyante_id` y `voluntarios_inscritos.apoyante_id` la referencian sin cascada. No hay `lib/public-queries.ts` (llega en #12). Ya existen `crearAccionPrivada()` y `ejecutarEscrituraAuditada()` (#4), el patrón de núcleo sin Next más acciones (`lib/proyectos-escrituras.ts` y `app/(privado)/proyectos/`), las lecturas privadas por `crearConsultasPrivadas(requerir, obtenerDb)` y componentes de formulario de cliente en `app/(privado)/proyectos/formularios.tsx`. Las pruebas corren en serie contra la rama `test-esquema`, con `enTransaccion()` y, para el bloqueo de filas, la conexión real del pool con limpieza propia. Requisitos en `specs/`; decisiones del usuario y motivación en `proposal.md`.

Es el primer dato personal real que el sistema administra. No hay revisión legal y el PRD ya lo marca como riesgo no verificado; se aplican criterios mínimos y se deja constancia.

## Goals / Non-Goals

**Goals:**
- Un registro de apoyantes usable por #7 (elegir donante) y #13 (vincular inscripciones), con la mínima información personal posible.
- Que el contacto no se replique en `audit_log` ni en logs, y que "Anónimo" salga de un solo lugar.
- Reglas de integridad de roles que se sostengan incluso con escrituras simultáneas.

**Non-Goals:**
- Borrar o anonimizar a pedido, exportar datos de una persona, retención y respaldo (decisión del usuario y #14).
- Consentimiento y formulario público de voluntariado (#13), lecturas y páginas públicas (#11, #12).
- Detección de apoyantes duplicados (A6, #7), validar el formato del contacto (teléfono, correo) o verificarlo.
- Resolver la revisión legal: se documenta como pendiente.

## Decisions

**1. Mismo patrón que proyectos: `lib/apoyantes-esquemas.ts` y `lib/apoyantes-escrituras.ts` sin Next.**
Cada escritura es un par `{ esquema, escribir }`; `app/(privado)/apoyantes/actions.ts` solo lo pasa a `crearAccionPrivada()`, y las pruebas lo ejecutan con `ejecutarEscrituraAuditada()`. Dos escrituras: `crearApoyante` y `editarApoyante`. No hay escritura de borrado. Los ayudantes de Zod que hoy viven dentro de `lib/proyectos-esquemas.ts` (`texto`, `textoOpcional`, `casilla`, `id`) se mueven a `lib/esquemas-formulario.ts` y los dos módulos los importan; es un refactor sin cambio de comportamiento, cubierto por las pruebas existentes.

**2. Validación Zod.**
`nombre`: 1–100 recortado; `contacto`: opcional, 0–200, vacío pasa a `null`; `esDonante`, `esVoluntario` y `anonimoPublico`: casillas; una regla del objeto exige al menos un rol y deja el error en la clave `roles` ("Elige al menos un rol") para mostrarlo bajo el grupo de casillas. El contacto es texto libre: puede ser un teléfono, un correo o "yapea a Rosa Q."; no se valida el formato porque la persona que registra sabe qué usa cada donante y un formato estricto bloquearía casos reales.

**3. Historial sin contacto: `valoresApoyante()`.**
Función única que arma `antes` y `despues` con `{ nombre, esDonante, esVoluntario, anonimoPublico, tieneContacto }`. Si el contacto cambió, `despues` añade `contactoModificado: true`. El valor del contacto nunca se pasa al historial, ni anterior ni nuevo. Así una edición solo del contacto deja rastro (quién y cuándo) sin copiar el dato a una segunda tabla. El nombre sí queda en el historial: es necesario para saber qué cambió y está en la misma tabla de la que sale el registro. Alternativa descartada: guardar todo el contacto (decisión del usuario: no).

**4. Edición: bloqueo de la fila y comprobación de roles.**
`editarApoyante` empieza con `select ... for update` sobre el apoyante. Con la fila bloqueada cuenta `donaciones` e `inscripciones` y rechaza quitar un rol que ya tiene registros ("Este apoyante ya tiene donaciones registradas" / "...inscripciones de voluntariado registradas"). El bloqueo importa porque insertar una donación toma un bloqueo de clave sobre la fila del apoyante, que choca con `for update`: así una edición de roles y un registro de donación simultáneos se ordenan y no dejan a un donante sin el rol que usó. Una prueba con conexión real lo comprueba y detecta la variante sin bloqueo (como en #5). Otras reglas: sin cambios ("No hay cambios para guardar"), apoyante inexistente ("No se encontró el apoyante"), y sin rol. La comparación de "sin cambios" incluye el valor del contacto aunque el historial no lo guarde.

**5. Nombre público en `lib/apoyantes-publico.ts`.**
`nombrePublico({ nombre, anonimoPublico })` devuelve `"Anónimo"` si la marca está puesta y el nombre si no, y exporta la constante `ANONIMO`. Es una función pura (sin base ni Next) para que #12 la use dentro de `lib/public-queries.ts`. No se construye ninguna lectura pública aquí (ADR 0007: las lecturas públicas son #12). La marca por defecto es falsa. Alternativa descartada: calcular "Anónimo" con una expresión SQL en cada consulta pública, que repetiría la regla en varios sitios.

**6. Lecturas: `listarApoyantes({ busqueda, rol })` y `getApoyante(id)` en `crearConsultasPrivadas`.**
`listarApoyantes` ejecuta `requerir()` antes que nada, selecciona solo `id`, `nombre`, roles y anonimato (nunca el contacto) y filtra en memoria: normaliza con `normalize("NFD")` sin diacríticos y en minúsculas, compara por "contiene", y aplica el filtro por rol (`donante`, `voluntario`; cualquier otro valor se ignora). Devuelve las primeras 200 y `hayMas`. Filtrar en JS evita las trampas del `ILIKE` (comodines `%` y `_` en lo que escribe la persona, y tildes, porque Postgres no trae `unaccent` por defecto en Neon). Con cientos o pocos miles de apoyantes cuesta una consulta de columnas pequeñas; si creciera mucho se pasa a `ILIKE` con escape. `getApoyante` devuelve el apoyante con el contacto y las cantidades de donaciones e inscripciones (para explicar por qué un rol no se puede quitar), o `null` si el id no existe o no es válido.

**7. Pantallas en `app/(privado)/apoyantes/`, todas `force-dynamic` y sin importar la base.**
- `/apoyantes`: formulario `GET` de búsqueda y rol (funciona sin JavaScript; `searchParams`), lista con nombre, roles y marca de anónimo, enlace "Nuevo apoyante" y aviso si hay más de 200.
- `/apoyantes/nuevo` y `/apoyantes/[id]`: formulario con nombre, contacto, casillas de rol y de anonimato (con el texto "En lo público se mostrará como «Anónimo»"). El detalle muestra el contacto y cuántas donaciones e inscripciones tiene.
- El panel y `proxy.ts` (que pasa a cubrir `/apoyantes`) se actualizan. Los formularios reutilizan los componentes compartidos que se extraen de `app/(privado)/proyectos/formularios.tsx` a un archivo común (`Campo`, `Mensajes`, `useCampos`), sin cambiar el comportamiento de proyectos.

**8. Minimización y ausencia de borrado.**
Una prueba estructural comprueba que ninguna acción ni módulo de apoyantes usa `.delete(` y que el formulario y el esquema no tienen campos distintos de los permitidos (nombre, contacto, roles, anonimato). `CLAUDE.md` documenta las decisiones mínimas y que falta revisión legal.

**9. Pruebas contra la rama de pruebas.**
Cada requisito tiene un caso: creación con roles, sin rol, datos inválidos, nombre repetido permitido, edición con y sin cambios, quitar roles con y sin registros, historial sin contacto (se serializa toda la fila de `audit_log` y no debe contener el valor), edición solo del contacto, mensajes y log sin datos personales ante un fallo de base (llamando a `escribir` con un nombre que Postgres rechaza), búsqueda sin tildes y con comodines, filtro por rol, límite de 200, nombre público, responsable desactivado y concurrencia con conexión real. Las pantallas se verifican a mano contra la rama de pruebas.

## Risks / Trade-offs

- [Falta revisión legal] → Criterios mínimos (datos mínimos, contacto fuera del historial, sin datos sensibles) y nota explícita en `CLAUDE.md` y en esta propuesta. No es cumplimiento legal; hay que revisarlo antes de usar datos reales (#14).
- [Sin consentimiento al registrar un donante a mano] → La persona registra datos que otra persona le dio; el consentimiento del formulario público llega con #13. Queda anotado.
- [Duplicados: la misma persona registrada dos veces] → No hay detección (A6 sigue abierto); la lista con búsqueda permite buscar antes de crear. #7 decide el aviso.
- [El nombre real queda en `audit_log`] → Necesario para el historial; solo lo ve un responsable activo, y no hay pantalla de historial. Si luego se anonimizara a pedido, habría que tratar también esas filas.
- [El contacto queda visible a cualquier responsable activo] → Son ~3 personas de confianza; no hay roles (A5).
- [Filtrar en memoria no escala a decenas de miles] → No es el caso de La FAZ; se documenta el cambio a `ILIKE` si hiciera falta.
- [#7 debe comprobar que el apoyante tenga el rol de donante] → Esta regla queda fuera, pero se anota para #7; el bloqueo de fila ya evita la carrera con la edición de roles.

## Migration Plan

No hay migración ni escritura en `production` al implementar. Tras desplegar, el responsable crea los apoyantes desde la interfaz. La reversión es revertir el commit; los apoyantes creados quedan en la base.

## Open Questions

- Revisión legal de la ley peruana de protección de datos y sus efectos (consentimiento, derechos de acceso y cancelación, retención): pendiente fuera del código; no cambia este diseño pero puede exigir cambios después.
- Si se necesitará borrar o anonimizar a pedido de la persona: decisión del usuario con el PRD, en un cambio aparte.
