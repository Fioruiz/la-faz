# donation-editing Specification

## Purpose

Permite corregir lo registrado: cambiar monto, medio, fecha, cantidad, descripción, proyecto o ítem de una donación, y asignar las que quedaron "Sin asignar", sin perder el rastro de quién cambió qué y manteniendo las reglas del registro.

## Requirements

### Requirement: Editar una donación
Un responsable activo SHALL poder editar el monto, el medio, la fecha, la cantidad, la descripción y el proyecto o ítem de una donación no anulada, y el tipo y el donante MUST NOT cambiar.

#### Scenario: Corregir un monto
- **WHEN** un responsable cambia el monto de una donación en dinero de 150,50 a 105,50
- **THEN** el monto queda actualizado y el historial guarda el valor anterior y el nuevo, atribuidos al responsable que editó

#### Scenario: Corregir una cantidad
- **WHEN** se cambia la cantidad de un producto de 500 a 450
- **THEN** la cantidad queda actualizada y el historial guarda ambos valores

#### Scenario: Tipo y donante fijos
- **WHEN** la entrada intenta cambiar el tipo o el donante
- **THEN** esos valores no cambian, y el formulario no ofrece esos campos

#### Scenario: Sin cambios
- **WHEN** se guarda el formulario sin cambiar ningún valor
- **THEN** no se escribe nada y se muestra "No hay cambios para guardar"

#### Scenario: Registrado por no cambia
- **WHEN** otro responsable edita una donación
- **THEN** `registrado_por` conserva a quien la registró y el historial registra a quien editó

### Requirement: Una edición vuelve a aplicar las reglas del registro
Cada edición SHALL cumplir las mismas reglas que el registro: medio obligatorio en dinero, monto y cantidad válidos, fecha no futura, proyecto activo, ítem del proyecto elegido y descripción obligatoria en producto sin asignar.

#### Scenario: Medio obligatorio
- **WHEN** se edita una donación en dinero dejando el medio vacío
- **THEN** no se guarda y se muestra el error del campo

#### Scenario: Fecha futura
- **WHEN** se cambia la fecha a una posterior a hoy en America/Lima
- **THEN** no se guarda y se muestra que la fecha no puede ser futura

#### Scenario: Ítem de otro proyecto
- **WHEN** se elige un ítem que no pertenece al proyecto elegido
- **THEN** no se guarda y se muestra que el ítem no pertenece al proyecto

#### Scenario: Producto sin asignar sin descripción
- **WHEN** se deja a un producto sin proyecto y sin descripción
- **THEN** no se guarda y se muestra el error del campo

### Requirement: Reasignar una donación a otro proyecto o ítem
Un responsable activo SHALL poder cambiar el proyecto o el ítem de una donación que ya tiene proyecto, o dejarla "Sin asignar", siempre que el proyecto de destino esté activo.

#### Scenario: Cambiar de proyecto
- **WHEN** se cambia una donación en dinero del proyecto A al proyecto B, ambos activos
- **THEN** la donación queda en B y el historial guarda el proyecto anterior y el nuevo

#### Scenario: Cambiar de ítem
- **WHEN** se cambia un producto de un ítem a otro ítem del mismo proyecto
- **THEN** el avance de cada ítem refleja el cambio y el historial guarda ambos ítems

#### Scenario: Destino finalizado
- **WHEN** el proyecto de destino está finalizado
- **THEN** no se guarda y se muestra que el proyecto ya está finalizado

#### Scenario: Dejar sin asignar
- **WHEN** se deja "Sin asignar" a una donación que tenía proyecto
- **THEN** una en dinero queda sin proyecto, y una en producto queda sin proyecto ni ítem con la descripción que se escriba

### Requirement: Asignar una donación "Sin asignar" en una sola operación
Un responsable activo SHALL poder asignar una donación "Sin asignar" a un proyecto activo y, si es producto, a un ítem de ese proyecto, en una sola operación con una sola fila de historial.

#### Scenario: Asignar dinero
- **WHEN** se asigna una donación en dinero sin proyecto a un proyecto activo
- **THEN** la donación queda con ese proyecto y una fila de historial de asignación con el proyecto anterior (ninguno) y el nuevo

#### Scenario: Asignar un producto
- **WHEN** se asigna un producto sin asignar a un proyecto con meta y a un ítem de ese proyecto
- **THEN** quedan proyecto e ítem a la vez, la descripción libre se borra y el historial conserva la descripción anterior

#### Scenario: Ítem obligatorio en producto
- **WHEN** se asigna un producto a un proyecto sin elegir ítem
- **THEN** no se guarda y se muestra "Elige el ítem"

#### Scenario: Proyecto sin meta
- **WHEN** se asigna un producto a un proyecto sin meta
- **THEN** no se guarda y se muestra que el proyecto no tiene meta

#### Scenario: Ya tiene proyecto
- **WHEN** se intenta asignar una donación que ya tiene proyecto con la operación de asignar
- **THEN** no se guarda y se indica que debe usarse la edición para reasignarla

### Requirement: Aviso de duplicados al editar o asignar
Una edición o asignación que deje la donación igual a otra no anulada del mismo donante (por el mismo criterio del registro) SHALL avisar y guardar solo tras confirmar, sin contarse a sí misma.

#### Scenario: Queda igual a otra
- **WHEN** una edición hace que la donación coincida en donante, tipo, fecha, proyecto y monto (o ítem y cantidad) con otra
- **THEN** se muestra la advertencia y no se guarda hasta confirmar "Guardar de todos modos"

#### Scenario: No se cuenta a sí misma
- **WHEN** se edita un campo que no cambia ninguno de los datos de comparación
- **THEN** no hay advertencia por coincidir consigo misma

### Requirement: No se edita lo anulado ni lo de un proyecto finalizado
El sistema MUST NOT editar ni asignar una donación anulada, ni una que pertenece a un proyecto finalizado.

#### Scenario: Donación anulada
- **WHEN** se intenta editar o asignar una donación anulada
- **THEN** no se guarda y se muestra que está anulada

#### Scenario: Donación de un proyecto finalizado
- **WHEN** se intenta editar una donación cuyo proyecto actual está finalizado
- **THEN** no se guarda y se muestra que el proyecto está finalizado

### Requirement: Escrituras serializadas por donación y proyecto
Cada edición o asignación SHALL bloquear la fila de la donación con `for update` y las filas de los proyectos implicados (actual y de destino) con `for share`, para que no se cruce con una anulación, una finalización o otra edición.

#### Scenario: Anulación simultánea
- **WHEN** una donación se anula mientras otra persona la edita
- **THEN** si la anulación se confirma primero, la edición se rechaza por anulada

#### Scenario: Cierre simultáneo
- **WHEN** el proyecto de destino se finaliza mientras otra persona le reasigna una donación
- **THEN** si el cierre se confirma primero, la reasignación se rechaza por proyecto finalizado

### Requirement: Historial de cada edición y asignación
Cada edición y asignación SHALL dejar una fila de historial con los valores anteriores y nuevos de la donación y el responsable que actuó, sin nombre ni contacto del donante.

#### Scenario: Contenido
- **WHEN** se edita una donación
- **THEN** el historial guarda tipo, monto o cantidad, medio, proyecto, ítem, descripción y fecha antes y después, y el identificador del donante

#### Scenario: Acción de asignación
- **WHEN** se asigna una donación "Sin asignar"
- **THEN** la fila de historial tiene la acción de asignación

### Requirement: Acceso solo para responsables activos
Las lecturas y escrituras de edición y asignación SHALL pasar por el acceso privado y comprobar al responsable activo.

#### Scenario: Responsable desactivado
- **WHEN** un responsable desactivado con sesión vigente intenta editar o asignar
- **THEN** no se guarda nada y es llevado al login
