# Spec Delta

## Purpose

Define cómo responden las acciones privadas a la interfaz: un resultado uniforme que distingue éxito, entrada inválida, regla de negocio y fallo inesperado, sin perder lo que la persona escribió ni revelar detalles internos.

## ADDED Requirements

### Requirement: Resultado uniforme de las acciones
Toda acción privada de escritura SHALL devolver un resultado que indique si tuvo éxito y, si no, de qué tipo fue el fallo: validación, regla de negocio o error inesperado.

#### Scenario: Éxito
- **WHEN** la escritura termina correctamente
- **THEN** el resultado indica éxito y trae los datos que la acción devuelve

#### Scenario: Tipos de fallo distinguibles
- **WHEN** una acción falla
- **THEN** el resultado permite distinguir entre entrada inválida, regla de negocio incumplida y error inesperado

### Requirement: Errores de validación con mensajes por campo
Cuando la entrada no cumple el esquema, el resultado SHALL traer los mensajes de error agrupados por campo y los valores que la persona escribió, para que el formulario los muestre sin perder lo escrito.

#### Scenario: Un campo inválido
- **WHEN** se envía un formulario con un campo inválido y otros válidos
- **THEN** el resultado trae el mensaje del campo inválido y los valores escritos de todos los campos

#### Scenario: Campos sensibles
- **WHEN** el formulario incluye un campo marcado como sensible, como una contraseña
- **THEN** el resultado no devuelve el valor escrito de ese campo

#### Scenario: Sin escritura
- **WHEN** el resultado es un error de validación
- **THEN** no se guarda ningún cambio ni historial

### Requirement: Reglas de negocio con mensaje claro
Cuando una regla de negocio impide la escritura, la acción SHALL revertir todo lo hecho y devolver un resultado de regla de negocio con un mensaje en español dirigido a la persona.

#### Scenario: Regla incumplida a mitad de la escritura
- **WHEN** la lógica de la escritura detecta una regla incumplida después de haber modificado una tabla
- **THEN** se revierten el cambio y el historial y el resultado trae el mensaje de la regla

#### Scenario: Mensaje de la regla
- **WHEN** el resultado es una regla de negocio incumplida
- **THEN** el mensaje es el escrito por la acción y no incluye texto técnico

### Requirement: Errores inesperados sin detalles al usuario
Ante un fallo inesperado, como una base que no responde o un error de Postgres, la acción SHALL devolver un mensaje genérico a la persona y registrar el detalle en el log del servidor, sin incluir cadenas de conexión ni datos personales.

#### Scenario: Falla la base
- **WHEN** la base no responde o rechaza una operación durante la escritura
- **THEN** el resultado trae un mensaje genérico sin el texto del error de la base y no queda ningún cambio a medias

#### Scenario: Detalle en el log
- **WHEN** ocurre un error inesperado
- **THEN** el log del servidor recibe el tipo de error y su código, y no recibe la cadena de conexión ni los valores de la entrada

### Requirement: Los redireccionamientos no se tratan como errores
Cuando la acción es rechazada por falta de sesión o de responsable activo, el sistema SHALL llevar a la persona al login y MUST NOT registrarlo como error inesperado ni mostrar un mensaje genérico.

#### Scenario: Responsable desactivado
- **WHEN** un responsable desactivado invoca una acción
- **THEN** es llevado al login y el log no registra un error inesperado
