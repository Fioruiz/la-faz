# donation-voiding Specification

## Purpose

Permite dar por inválida una donación sin borrarla: queda guardada, marcada como anulada y con su motivo en el historial, y deja de contar en el avance, los totales y los avisos de duplicados.

## Requirements

### Requirement: Anular una donación sin borrarla
Un responsable activo SHALL poder anular una donación, y la fila MUST conservarse con todos sus valores y `anulada` verdadero.

#### Scenario: Anulación
- **WHEN** un responsable anula una donación
- **THEN** la fila sigue existiendo con los mismos valores y `anulada = true`, y el historial registra la anulación atribuida al responsable

#### Scenario: Sin borrado
- **WHEN** se revisa la interfaz y las acciones de donaciones
- **THEN** no existe ninguna operación que elimine filas de `donaciones`

### Requirement: Motivo obligatorio de anulación
La anulación SHALL exigir un motivo de 1 a 200 caracteres, que se guarda solo en el historial.

#### Scenario: Motivo válido
- **WHEN** se anula con el motivo "Registrada dos veces por error"
- **THEN** el historial guarda ese motivo y la donación no tiene columna ni campo nuevo

#### Scenario: Sin motivo o demasiado largo
- **WHEN** el motivo está vacío, solo tiene espacios o supera 200 caracteres
- **THEN** no se anula, no queda historial y se muestra el error del campo conservando lo escrito

### Requirement: La anulación no se revierte
El sistema MUST NOT ofrecer ni ejecutar la restauración de una donación anulada, y anular una ya anulada SHALL rechazarse.

#### Scenario: Anular otra vez
- **WHEN** se intenta anular una donación ya anulada
- **THEN** no cambia nada y se muestra que ya está anulada

#### Scenario: Sin restaurar
- **WHEN** se abre una donación anulada
- **THEN** se muestra como anulada y no ofrece restaurarla, editarla ni asignarla

### Requirement: Lo anulado deja de contar
Una donación anulada MUST NOT contarse como duplicado de una donación nueva ni vincularse a una donación mixta nueva, y SHALL quedar marcada con `anulada = true` para que el avance y los totales de #9 y #10 la excluyan.

#### Scenario: Duplicado
- **WHEN** la única coincidencia de una donación nueva es una anulada
- **THEN** se registra sin advertencia

#### Scenario: Donación mixta
- **WHEN** se intenta registrar la otra parte de una donación anulada
- **THEN** se rechaza porque está anulada

#### Scenario: Marca para el avance
- **WHEN** se anula una donación en producto asignada a un ítem
- **THEN** la fila conserva su ítem y su cantidad con `anulada = true`, y la regla de avance del ADR 0008 (producto no anulado) la excluye

### Requirement: Anular una parte de una donación mixta
Anular una donación vinculada SHALL afectar solo a esa donación, y el vínculo con la otra se conserva.

#### Scenario: Una parte anulada
- **WHEN** se anula la primera parte de una donación mixta
- **THEN** la segunda sigue vigente y conserva su vínculo con la primera

### Requirement: No se anula lo de un proyecto finalizado
El sistema MUST NOT anular una donación asignada a un proyecto finalizado.

#### Scenario: Proyecto finalizado
- **WHEN** se intenta anular una donación de un proyecto finalizado
- **THEN** no cambia nada y se muestra que el proyecto está finalizado

### Requirement: Anulación serializada con la donación
La anulación SHALL bloquear la fila de la donación con `for update` y el proyecto con `for share`, para no cruzarse con una edición o una finalización.

#### Scenario: Edición simultánea
- **WHEN** una donación se edita mientras otra persona la anula
- **THEN** si la edición se confirma primero, la anulación ve los valores nuevos y, si se confirma la anulación primero, la edición se rechaza

### Requirement: Historial de la anulación
La anulación SHALL dejar una fila de historial con el estado anterior, el posterior y el motivo, sin nombre ni contacto del donante.

#### Scenario: Contenido
- **WHEN** se anula una donación
- **THEN** el historial guarda `anulada` antes y después, el motivo y el identificador del donante

### Requirement: Acceso solo para responsables activos
La anulación SHALL pasar por el acceso privado y comprobar al responsable activo.

#### Scenario: Responsable desactivado
- **WHEN** un responsable desactivado con sesión vigente intenta anular
- **THEN** no cambia nada y es llevado al login
