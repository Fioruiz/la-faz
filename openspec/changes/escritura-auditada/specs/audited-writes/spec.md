# Spec Delta

## Purpose

Garantiza que cada escritura de la zona privada la haga un responsable activo, con la entrada validada, y que su cambio y su registro de historial queden guardados juntos o no queden.

## ADDED Requirements

### Requirement: Responsable activo antes de cualquier otra operación
Toda escritura privada SHALL comprobar en la base que el responsable de la sesión existe y está activo antes de validar la entrada o tocar cualquier tabla de negocio.

#### Scenario: Responsable activo
- **WHEN** un responsable activo invoca una escritura con entrada válida
- **THEN** la escritura se ejecuta y queda atribuida a ese responsable

#### Scenario: Responsable desactivado con sesión vigente
- **WHEN** un responsable desactivado, con una sesión aún vigente, invoca una escritura
- **THEN** la acción se rechaza, no se valida su entrada, no se guarda ningún cambio ni historial, y la persona es llevada al login

#### Scenario: Sin sesión
- **WHEN** una escritura privada se invoca sin sesión
- **THEN** se rechaza sin consultar ninguna tabla de negocio y la persona es llevada al login

### Requirement: Entrada validada con un esquema
Toda escritura privada SHALL validar su entrada contra un esquema antes de guardar, y MUST NOT escribir nada cuando la entrada no cumple el esquema.

#### Scenario: Entrada que cumple el esquema
- **WHEN** la entrada cumple el esquema de la acción
- **THEN** la escritura recibe los datos ya validados y tipados, no los datos originales

#### Scenario: Entrada que no cumple el esquema
- **WHEN** falta un campo obligatorio, o un valor excede su límite o su formato
- **THEN** no se guarda ningún cambio ni historial

### Requirement: Cambio e historial en una sola transacción
El cambio y su registro en `audit_log` SHALL guardarse en una misma transacción, de modo que o quedan ambos o no queda ninguno.

#### Scenario: Escritura correcta
- **WHEN** una escritura termina sin error
- **THEN** existen el cambio y al menos una fila en `audit_log` que lo describe

#### Scenario: Falla el cambio
- **WHEN** el cambio de negocio falla a mitad de la escritura
- **THEN** no queda ninguna fila nueva de negocio ni de `audit_log`

#### Scenario: Falla el registro de historial
- **WHEN** el registro en `audit_log` falla después de haberse aplicado el cambio
- **THEN** el cambio se revierte y la tabla de negocio queda como estaba

### Requirement: El historial es obligatorio
Toda escritura SHALL declarar al menos un registro de historial, y una escritura que no lo declare MUST ser rechazada y revertida.

#### Scenario: Escritura sin registro de historial
- **WHEN** la lógica de una escritura termina sin declarar ningún registro de historial
- **THEN** el cambio se revierte, no queda ninguna fila nueva y la acción informa un error inesperado

#### Scenario: Varios registros en una escritura
- **WHEN** una escritura modifica más de una entidad y declara un registro por cada una
- **THEN** quedan todos en `audit_log`, en la misma transacción

### Requirement: Contenido del registro de historial
Cada fila de `audit_log` SHALL guardar la entidad, el id, la acción, el estado anterior y posterior, el responsable que actuó y la fecha, y MUST atribuirse al responsable comprobado en la sesión, nunca a un valor de la entrada.

#### Scenario: Creación
- **WHEN** se crea un registro
- **THEN** la fila de historial tiene la acción de creación, el estado anterior vacío y el estado posterior con los valores guardados

#### Scenario: Edición
- **WHEN** se edita un registro
- **THEN** la fila de historial guarda los valores antes y después del cambio

#### Scenario: Atribución
- **WHEN** la entrada de una acción incluye un identificador de responsable distinto del de la sesión
- **THEN** el historial se atribuye al responsable de la sesión

#### Scenario: Fecha
- **WHEN** se guarda un registro de historial
- **THEN** su fecha es la de la base de datos en el momento de la transacción

### Requirement: Datos del historial elegidos por cada acción
El historial SHALL guardar solo los valores que cada acción declara y MUST NOT copiar automáticamente filas completas, para que las acciones excluyan contraseñas, hashes y datos que no deban quedar en el historial.

#### Scenario: Valores declarados
- **WHEN** una acción declara su estado anterior y posterior
- **THEN** `audit_log` guarda exactamente esos valores y ningún otro campo de la fila

#### Scenario: Valores no serializables
- **WHEN** una acción declara en el historial un valor que no puede guardarse como JSON
- **THEN** la escritura se revierte y la acción informa un error inesperado

### Requirement: Las acciones privadas pasan por el patrón
Las Server Actions de escritura de la zona privada MUST usar el ejecutor de escrituras auditadas, y ninguna SHALL escribir en tablas de negocio por otra vía.

#### Scenario: Acción de escritura que no usa el patrón
- **WHEN** se revisa el código de las acciones de `app/(privado)/`
- **THEN** toda acción que escribe en la base usa el ejecutor, y las únicas excepciones son las que no escriben en la base, como cerrar sesión
