# supporter-privacy Specification

## Purpose

Limita los datos personales de donantes y voluntarios al mínimo necesario, impide que el contacto se copie al historial y fija cuándo una persona se presenta como "Anónimo" en lo público. Está sujeto a revisión legal pendiente.

## Requirements

### Requirement: Datos personales mínimos
El sistema SHALL guardar de cada apoyante solo el nombre, un contacto de texto libre opcional, los roles y la marca de anonimato, y MUST NOT guardar documentos de identidad, direcciones, fechas de nacimiento, números de cuenta ni credenciales.

#### Scenario: Campos del apoyante
- **WHEN** se revisa el formulario de apoyantes y lo que guardan las acciones
- **THEN** los únicos datos de la persona son nombre, contacto, roles y anonimato

#### Scenario: Contacto opcional
- **WHEN** se crea un apoyante sin contacto
- **THEN** se guarda sin contacto, no con un texto vacío

### Requirement: El contacto no pasa al historial
El historial de creación y edición de apoyantes MUST NOT guardar el valor del contacto, ni anterior ni nuevo, y SHALL guardar solo nombre, roles, anonimato y si el apoyante tiene contacto.

#### Scenario: Creación con contacto
- **WHEN** se crea un apoyante con el contacto "999 888 777"
- **THEN** el historial guarda nombre, roles, anonimato y que tiene contacto, y no contiene ese número en ningún campo

#### Scenario: Cambio solo del contacto
- **WHEN** se edita únicamente el contacto de un apoyante
- **THEN** la edición se guarda, el historial indica que el contacto fue modificado y no contiene ni el valor anterior ni el nuevo

#### Scenario: Quitar el contacto
- **WHEN** se deja vacío el contacto de un apoyante que lo tenía
- **THEN** el historial refleja que ya no tiene contacto, sin su valor

### Requirement: Los errores no exponen datos personales
Los registros del servidor y los mensajes de error de las acciones de apoyantes MUST NOT incluir nombres ni contactos.

#### Scenario: Fallo de la base al guardar
- **WHEN** falla la base al crear o editar un apoyante
- **THEN** el mensaje al usuario es el genérico y el log no contiene el nombre ni el contacto escritos

### Requirement: Anonimato público
Un apoyante con la marca de anonimato público SHALL presentarse como "Anónimo" en cualquier dato público, y su nombre real MUST quedar solo en la zona privada.

#### Scenario: Apoyante anónimo
- **WHEN** se pide el nombre público de un apoyante marcado como anónimo
- **THEN** el resultado es "Anónimo", sin ninguna parte de su nombre real

#### Scenario: Apoyante no anónimo
- **WHEN** se pide el nombre público de un apoyante sin la marca
- **THEN** el resultado es su nombre

#### Scenario: Por defecto
- **WHEN** se crea un apoyante sin marcar el anonimato
- **THEN** no es anónimo público

#### Scenario: Cambiar la marca
- **WHEN** un responsable marca o desmarca el anonimato de un apoyante
- **THEN** el cambio queda en el historial y el nombre público cambia en consecuencia

### Requirement: Una sola regla de nombre público
La presentación del nombre de un apoyante en datos públicos SHALL salir de una única función compartida, para que ninguna lectura pública decida por su cuenta cuándo mostrar el nombre real.

#### Scenario: Función compartida
- **WHEN** una lectura pública necesita mostrar el nombre de un apoyante
- **THEN** usa la función de nombre público y no el campo del nombre directamente

### Requirement: Aviso de revisión legal pendiente
La documentación del proyecto SHALL indicar que el tratamiento de datos personales de donantes y voluntarios no ha tenido revisión legal y que el consentimiento queda para el formulario público de voluntariado.

#### Scenario: Nota en la documentación
- **WHEN** se lee `CLAUDE.md` tras este cambio
- **THEN** indica que falta revisión legal de la ley peruana de protección de datos y qué decisiones se tomaron como medida mínima
