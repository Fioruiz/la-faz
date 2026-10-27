# mixed-donation Specification

## Purpose

Permite registrar una entrega que combina dinero y productos como dos donaciones vinculadas del mismo donante, para que cada parte cuente donde corresponde (dinero en el total en soles, producto en la barra del ítem).

## Requirements

### Requirement: Registrar la otra parte de una donación mixta
Tras registrar una donación, el responsable SHALL poder registrar la otra parte como una segunda donación de tipo distinto del mismo donante, que queda vinculada a la primera.

#### Scenario: Segundo paso
- **WHEN** el responsable registra una donación y elige "Registrar la otra parte"
- **THEN** se abre el formulario con el donante precargado y fijo, el tipo opuesto seleccionado, y la fecha y el proyecto de la primera como valores por defecto

#### Scenario: Vínculo
- **WHEN** se guarda la segunda donación
- **THEN** queda con el identificador de la primera en `donacion_vinculada_id`, el mismo donante y un tipo distinto, y cada una cuenta por separado (dinero al total en soles, producto a su ítem)

### Requirement: Reglas de la donación vinculada
La acción SHALL rechazar un vínculo con una donación que no exista, sea de otro donante, sea del mismo tipo, esté anulada o ya forme parte de una pareja.

#### Scenario: Otro donante
- **WHEN** la donación vinculada es de otro donante
- **THEN** no se guarda y se muestra que debe ser del mismo donante

#### Scenario: Mismo tipo
- **WHEN** la vinculada es del mismo tipo que la nueva
- **THEN** no se guarda y se muestra que debe ser de tipo distinto

#### Scenario: Anulada o inexistente
- **WHEN** la vinculada está anulada o no existe
- **THEN** no se guarda y se muestra que no se puede vincular

#### Scenario: Ya vinculada
- **WHEN** la vinculada ya está vinculada con otra donación, o ya otra la tiene como vinculada
- **THEN** no se guarda y se muestra que ya forma parte de una donación mixta

### Requirement: El vínculo no cambia las reglas de cada parte
Cada parte de una donación mixta SHALL cumplir por sí misma todas las reglas de registro (proyecto activo, ítem del proyecto, rol de donante, medio en dinero, fecha) y el aviso de duplicados.

#### Scenario: Parte en producto sin proyecto
- **WHEN** la segunda parte es un producto y se elige "Sin asignar"
- **THEN** se guarda sin proyecto y con descripción, vinculada a la primera

#### Scenario: Proyecto distinto
- **WHEN** la segunda parte se asigna a otro proyecto activo
- **THEN** se permite

### Requirement: Historial del vínculo
El historial de la segunda donación SHALL registrar el identificador de la donación vinculada.

#### Scenario: Contenido
- **WHEN** se guarda la segunda parte
- **THEN** su fila de historial incluye el identificador de la primera
