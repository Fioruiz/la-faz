# duplicate-warning Specification

## Purpose

Evita registrar dos veces la misma donación por descuido avisando antes de guardar, sin bloquear las donaciones legítimas idénticas (ADR 0006: el PRD dice "avisa", no "impide").

## Requirements

### Requirement: Aviso de duplicado en dinero
Antes de guardar una donación en dinero, el sistema SHALL buscar una donación no anulada con el mismo donante, monto, fecha y proyecto, y si existe SHALL avisar sin guardar hasta que el responsable confirme.

#### Scenario: Existe una igual
- **WHEN** se registra S/ 100 del mismo donante, para el mismo proyecto y fecha, y ya existe una donación igual no anulada
- **THEN** no se guarda, se muestra una advertencia que describe la coincidencia y se ofrece "Guardar de todos modos"

#### Scenario: Confirmación
- **WHEN** el responsable confirma "Guardar de todos modos"
- **THEN** la donación se guarda y el historial indica que el duplicado fue confirmado

#### Scenario: Sin coincidencia
- **WHEN** cambia cualquiera de donante, monto, fecha o proyecto respecto a las existentes
- **THEN** se guarda sin advertencia

#### Scenario: Sin asignar
- **WHEN** dos donaciones sin proyecto coinciden en donante, monto y fecha
- **THEN** cuentan como iguales

### Requirement: Aviso de duplicado en producto
El mismo aviso SHALL aplicar a donaciones en producto con el criterio mismo donante, ítem (o la misma descripción sin distinguir mayúsculas si no hay ítem), cantidad, fecha y proyecto.

#### Scenario: Producto asignado igual
- **WHEN** se registran 500 unidades del mismo ítem, donante y fecha, y ya existe una igual no anulada
- **THEN** se muestra la advertencia y no se guarda hasta confirmar

#### Scenario: Producto sin asignar igual
- **WHEN** se registran 20 "cajas de cereal" sin asignar con el mismo donante y fecha que una existente con la descripción "Cajas de Cereal"
- **THEN** se muestra la advertencia

#### Scenario: Distinto tipo
- **WHEN** existe dinero y se registra producto del mismo donante, fecha y proyecto
- **THEN** no hay advertencia, porque son tipos distintos

### Requirement: Las anuladas no cuentan
Una donación anulada MUST NOT contar como duplicado.

#### Scenario: Coincide solo con una anulada
- **WHEN** la única coincidencia es una donación anulada
- **THEN** se guarda sin advertencia

### Requirement: El aviso no es atómico ni bloquea
El aviso SHALL ser una comprobación de la aplicación sin restricción única en la base, de modo que las donaciones idénticas legítimas puedan guardarse tras confirmar.

#### Scenario: Dos donaciones idénticas legítimas
- **WHEN** el responsable confirma el aviso
- **THEN** quedan dos donaciones iguales guardadas

### Requirement: Variante de resultado "advertencia"
El resultado de las acciones privadas SHALL incluir un tipo `advertencia` con un mensaje, que no guarda nada y que el formulario muestra junto a una acción de confirmación.

#### Scenario: Resultado de advertencia
- **WHEN** una acción detecta una situación que requiere confirmación
- **THEN** devuelve el tipo `advertencia` con su mensaje y revierte cualquier cambio hecho

#### Scenario: No es un error
- **WHEN** una acción devuelve una advertencia
- **THEN** el log del servidor no registra un error inesperado

### Requirement: La advertencia describe la coincidencia sin datos personales
El mensaje de advertencia SHALL indicar la fecha, el tipo y el proyecto de la donación coincidente, y MUST NOT incluir el nombre ni el contacto del donante.

#### Scenario: Contenido del mensaje
- **WHEN** se muestra la advertencia
- **THEN** menciona cuántas donaciones iguales hay y su fecha, y no el nombre del donante
