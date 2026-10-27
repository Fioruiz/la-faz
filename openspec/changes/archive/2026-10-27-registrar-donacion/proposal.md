# Proposal

## Why

Es el corazón del sistema: hoy las donaciones viven en un cuaderno o en un WhatsApp, y todo lo demás (avance, "falta en soles", reporte, barra pública) se calcula sobre lo que aquí se registre. Con proyectos e ítems (#5) y apoyantes (#6) ya construidos, un responsable puede por fin registrar una donación. El PRD fija el criterio de éxito de que registrar una donación tome menos de 2 minutos y define los casos borde que este ítem debe cubrir: donación sin proyecto ("Sin asignar"), donación mixta, aviso de duplicados y proyecto finalizado. Registrar mal una donación rompe "la barra pública coincide exactamente con lo registrado", así que las reglas de integridad del ADR 0008 se aplican en la acción además de la base.

## What Changes

Alcance estricto del ítem #7 del backlog ("Registrar donación"):

- Un formulario de una sola pantalla para registrar una donación en **dinero** (monto y medio) o en **producto** (ítem y cantidad), con el donante elegido de una lista filtrable de apoyantes con rol de donante y un enlace para crear uno nuevo en otra pestaña.
- **Sin asignar**: una donación sin proyecto. Un producto sin asignar lleva una descripción en texto libre de lo recibido (`descripcion_producto`) y no tiene ítem.
- **Rechazo de proyectos finalizados**: no aparecen como opción y la acción los rechaza.
- **Donación mixta**: se registra como dos donaciones vinculadas del mismo donante; tras guardar la primera, un segundo paso precarga al donante para registrar la otra parte.
- **Aviso blando de duplicados** (ADR 0006), también para productos con el mismo criterio: si existe una donación igual, la acción avisa y solo guarda si el responsable confirma "Guardar de todos modos".
- Valores por defecto para cumplir "menos de 2 minutos": fecha de hoy en la zona America/Lima y el último proyecto que usó ese responsable.
- Reglas en la acción: el medio es obligatorio en dinero (decisión del usuario, sin migración); el donante debe tener el rol de donante; un producto asignado debe usar un ítem del proyecto elegido; no se aceptan fechas futuras.
- La acción usa `crearAccionPrivada()`: valida, comprueba al responsable y guarda la donación y su historial en una transacción. El resultado gana una variante `advertencia` para el aviso de duplicados.
- Pruebas contra Postgres real de cada regla, incluidas las carreras con la finalización de un proyecto y con la edición de roles del donante.

Decisiones del usuario: (1) el aviso de duplicados también aplica a productos; (2) el medio es obligatorio en dinero y no aplica a productos; (3) el donante se elige entre apoyantes existentes, sin alta rápida dentro del formulario.

Supuestos registrados: la fecha de hoy se calcula en America/Lima (no en la hora del servidor, que en Vercel es UTC); el proyecto por defecto sale de la última donación del responsable; el dinero puede asignarse a cualquier proyecto activo, con o sin meta; un producto asignado exige un proyecto con meta y un ítem de ese proyecto; la donación vinculada apunta a la primera y ambas deben ser del mismo donante y de tipo distinto.

Fuera de alcance (otros ítems): editar, anular y asignar donaciones (#8), lista y reporte de donaciones (#10), avance y "falta en soles" (#9), páginas públicas (#11, #12), alta de apoyantes dentro del formulario, pagos o cobros (el sistema solo registra lo que el responsable declara haber recibido), la zona horaria global y el respaldo (#14), cambios de esquema y migraciones.

## Capabilities

### New Capabilities
- `donation-registration`: un responsable activo registra donaciones en dinero o producto, asignadas a un proyecto o "Sin asignar", con reglas de integridad, fecha y proyecto por defecto y su historial.
- `duplicate-warning`: antes de guardar, el sistema avisa de una donación igual y solo la guarda si el responsable confirma; el resultado de las acciones gana la variante `advertencia`.
- `mixed-donation`: una donación mixta se registra como dos donaciones vinculadas del mismo donante, con un segundo paso que precarga los datos de la primera.

### Modified Capabilities
<!-- Ninguna: los specs existentes pertenecen a cambios aún no archivados. La variante `advertencia` del resultado se declara como requisito nuevo en `duplicate-warning`. -->

## Impact

- **Código nuevo:** esquema Zod, lógica de escritura sin Next, lecturas del formulario, acción, pantalla de registro, utilidades de fecha en America/Lima y pruebas.
- **Código existente:** `lib/escritura-auditada-core.ts` gana la variante `advertencia` y su error; `lib/private-queries-core.ts` gana lecturas del formulario; el panel gana un enlace; `proxy.ts` cubre `/donaciones`; `CLAUDE.md` gana una nota.
- **Dependencias nuevas:** ninguna.
- **Sistemas externos:** ninguno. No hay migración ni escritura en `production` al implementar; las donaciones reales las registra el responsable desde la interfaz.
- **Pendientes del TDD que se tocan:** A6 se cubre en lo que el PRD define (más productos por decisión del usuario); donantes anónimos y apoyantes repetidos siguen abiertos. A7 se toca solo en la fecha (America/Lima) y el monto; el resto va en #14.
