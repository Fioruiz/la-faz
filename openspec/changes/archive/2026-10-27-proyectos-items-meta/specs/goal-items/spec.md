# Spec Delta

## Purpose

Permite definir las metas de cada campaña como ítems (por ejemplo, 2000 packs) con un costo referencial opcional, y mantiene coherentes los ítems con el estado y la meta de su proyecto.

## ADDED Requirements

### Requirement: Crear un ítem con meta
Un responsable activo SHALL poder crear un ítem en un proyecto activo con meta, indicando nombre, unidad y cantidad meta, y el ítem SHALL quedar asociado a ese proyecto.

#### Scenario: Ítem válido
- **WHEN** un responsable crea en "10 Derechos" el ítem "Pack de útiles" con unidad "pack" y meta 2000
- **THEN** el ítem existe en ese proyecto con meta 2000 y el historial registra su creación

#### Scenario: Límites de los campos
- **WHEN** el nombre está vacío o supera 100 caracteres, la unidad está vacía o supera 30, o la meta no es un entero entre 1 y 1.000.000
- **THEN** no se crea el ítem, no queda historial y se muestra el error del campo conservando lo escrito

#### Scenario: Proyecto sin meta
- **WHEN** se intenta crear un ítem en un proyecto sin meta
- **THEN** no se crea y se muestra que ese proyecto no tiene meta

#### Scenario: Proyecto finalizado
- **WHEN** se intenta crear un ítem en un proyecto finalizado
- **THEN** no se crea y se muestra que el proyecto está finalizado

### Requirement: Costo referencial opcional por unidad
Un ítem MAY tener un costo referencial en soles por unidad, mayor que cero y con hasta dos decimales, y SHALL poder crearse y editarse sin él.

#### Scenario: Con costo
- **WHEN** se crea un ítem con costo referencial "13.50" (o "13,50")
- **THEN** el ítem guarda el costo 13.50

#### Scenario: Sin costo
- **WHEN** se deja vacío el costo referencial
- **THEN** el ítem se guarda sin costo, no con cero

#### Scenario: Costo inválido
- **WHEN** el costo es cero, negativo, tiene más de dos decimales, no es numérico o supera 9.999.999,99
- **THEN** no se guarda y se muestra el error del campo

#### Scenario: Quitar el costo
- **WHEN** se edita un ítem con costo y se deja el costo vacío
- **THEN** el ítem queda sin costo y el historial lo registra

### Requirement: Nombres de ítem únicos dentro de su proyecto
Dentro de un mismo proyecto, dos ítems MUST NOT tener el mismo nombre, sin distinguir mayúsculas ni espacios al inicio y al final.

#### Scenario: Nombre repetido
- **WHEN** se crea o renombra un ítem con el nombre de otro ítem del mismo proyecto
- **THEN** no se guarda y se muestra "Ya existe un ítem con ese nombre en este proyecto"

#### Scenario: Mismo nombre en otro proyecto
- **WHEN** se crea un ítem con un nombre que existe en otro proyecto
- **THEN** se guarda

### Requirement: Editar un ítem de un proyecto activo
Un responsable activo SHALL poder editar nombre, unidad, cantidad meta y costo referencial de un ítem de un proyecto activo, y cada edición SHALL registrar los valores anteriores y nuevos.

#### Scenario: Cambiar la meta
- **WHEN** un responsable cambia la meta de un ítem de 2000 a 2500
- **THEN** la meta queda en 2500 y el historial guarda 2000 y 2500

#### Scenario: Meta menor que lo recibido
- **WHEN** se baja la meta de un ítem por debajo de la cantidad ya recibida
- **THEN** el cambio se permite, porque el excedente lo muestra el avance

#### Scenario: Sin cambios
- **WHEN** se guarda un ítem sin cambiar ningún valor
- **THEN** no se escribe nada y se muestra "No hay cambios para guardar"

#### Scenario: Ítem de otro proyecto
- **WHEN** se intenta editar un ítem usando el identificador de un proyecto al que no pertenece
- **THEN** no se modifica y se muestra que el ítem no se encontró en ese proyecto

#### Scenario: Proyecto finalizado
- **WHEN** se intenta editar un ítem de un proyecto finalizado
- **THEN** no cambia nada y se muestra que el proyecto está finalizado

### Requirement: Los ítems no se borran
El sistema MUST NOT ofrecer ni ejecutar el borrado de proyectos ni de ítems; los errores se corrigen editando.

#### Scenario: Sin borrado
- **WHEN** se revisa la interfaz y las acciones de proyectos e ítems
- **THEN** no existe ninguna operación que elimine filas de `proyectos` ni de `items_meta`

### Requirement: Escrituras serializadas por proyecto
Cada escritura de proyecto o de ítem SHALL bloquear la fila de su proyecto durante la transacción, para que una finalización y una creación o edición de ítem no se crucen.

#### Scenario: Finalizar y agregar ítem a la vez
- **WHEN** se finaliza un proyecto y a la vez se agrega un ítem a ese proyecto
- **THEN** una de las dos operaciones termina primero; si la finalización va primero, la creación del ítem se rechaza por proyecto finalizado
