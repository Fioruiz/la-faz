# Spec Delta

## Purpose

Muestra a los responsables cuánto se recibió y cuánto falta, en la lista de proyectos y en cada proyecto, con lo recibido por ítem, el excedente real, el total en soles y lo pendiente de asignar, sin pasos adicionales.

## ADDED Requirements

### Requirement: Avance por ítem en el detalle del proyecto
La página de un proyecto con meta SHALL mostrar, para cada ítem, una barra de avance con lo recibido, la meta, la unidad, el porcentaje real y el excedente cuando lo haya.

#### Scenario: Avance parcial
- **WHEN** un ítem con meta 2000 packs recibió 1200
- **THEN** se ve "1200 de 2000 packs" con la barra al 60%

#### Scenario: Excedente
- **WHEN** un ítem con meta 2000 recibió 2150
- **THEN** la barra se llena, se ve "2150 de 2000" y el excedente "+150 sobre la meta"

#### Scenario: Sin donaciones
- **WHEN** un ítem no recibió nada
- **THEN** se ve "0 de 2000" con la barra vacía

#### Scenario: Accesibilidad
- **WHEN** se lee la barra con tecnología de asistencia
- **THEN** expone su valor actual y máximo y no depende solo del color

### Requirement: Resumen del proyecto sin mezclar unidades
La página de un proyecto SHALL mostrar un resumen con las metas cumplidas ("1 de 2 metas cumplidas"), el total recibido en soles y la falta en soles, y MUST NOT mostrar un porcentaje único del proyecto.

#### Scenario: Con costos
- **WHEN** un proyecto tiene ítems con costo y recibió dinero
- **THEN** el resumen muestra el total en soles y la falta en soles

#### Scenario: Estimado parcial
- **WHEN** algún ítem del proyecto no tiene costo referencial
- **THEN** la falta en soles lleva la indicación "estimado parcial" y qué significa

#### Scenario: Falta no disponible
- **WHEN** ningún ítem tiene costo
- **THEN** en lugar de la falta se muestra que no se puede estimar y que falta cargar costos de referencia

#### Scenario: Informativo
- **WHEN** el proyecto no tiene meta
- **THEN** no hay barras ni metas; si recibió dinero se muestra solo el total en soles

#### Scenario: Finalizado
- **WHEN** el proyecto está finalizado
- **THEN** el avance se muestra igual, como su resultado final, en solo lectura

### Requirement: Resumen por proyecto en la lista
La lista de proyectos SHALL mostrar en cada fila las metas cumplidas, el total en soles y la falta en soles, para ver cuánto falta sin abrir cada proyecto.

#### Scenario: Fila con meta
- **WHEN** un proyecto con meta aparece en la lista
- **THEN** su fila muestra "N de M metas cumplidas" y el total en soles

#### Scenario: Fila informativa
- **WHEN** un proyecto informativo aparece en la lista
- **THEN** su fila no muestra metas, y muestra el total en soles si recibió dinero

### Requirement: Bloque "Sin asignar"
Las pantallas de proyectos SHALL mostrar un bloque "Sin asignar" con el total en soles y la cantidad de donaciones pendientes, con un enlace a la lista de donaciones filtrada, y MUST NOT contarlo en ninguna barra.

#### Scenario: Con pendientes
- **WHEN** hay donaciones sin asignar
- **THEN** el bloque muestra su total en soles, su cantidad y el enlace "Ver y asignar"

#### Scenario: Sin pendientes
- **WHEN** no hay donaciones sin asignar
- **THEN** el bloque indica que no hay nada pendiente de asignar

#### Scenario: Enlace
- **WHEN** se usa el enlace
- **THEN** abre la lista de donaciones con el filtro "Sin asignar"

### Requirement: El avance cambia con las donaciones en la misma carga
Una donación registrada, editada, reasignada o anulada SHALL reflejarse en el avance en la siguiente carga de página, sin cachés.

#### Scenario: Registrar
- **WHEN** se registra una donación en producto para un ítem y se recarga el proyecto
- **THEN** lo recibido del ítem sube en esa cantidad

#### Scenario: Reasignar
- **WHEN** una donación se reasigna a otro ítem
- **THEN** el primero baja y el segundo sube en la siguiente lectura

#### Scenario: Anular
- **WHEN** una donación se anula
- **THEN** deja de contar en el avance y en el total en soles

### Requirement: Lecturas por el acceso privado
El avance SHALL leerse por el acceso privado y comprobar al responsable activo.

#### Scenario: Responsable desactivado
- **WHEN** un responsable desactivado con sesión vigente pide el avance
- **THEN** no recibe datos y es llevado al login

#### Scenario: Sin datos personales
- **WHEN** se revisa lo que devuelve la lectura de avance
- **THEN** no incluye nombres ni contactos de donantes
