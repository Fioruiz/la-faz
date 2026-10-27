# volunteer-signup Specification

## Purpose

Permite que una persona se inscriba como voluntaria de La FAZ desde la web pública, sin crear cuenta, dando su consentimiento para el uso de sus datos, y que la inscripción llegue a la zona privada sin que un envío automático o malicioso ensucie los registros.

## Requirements

### Requirement: Formulario público de inscripción
La página `/voluntariado` SHALL mostrar un formulario con nombre y contacto obligatorios, un mensaje opcional y una casilla de consentimiento obligatoria, y SHALL permitir enviarlo sin iniciar sesión ni crear cuenta. El formulario NO SHALL pedir edad, documento de identidad, dirección, ciudad ni proyecto de interés.

#### Scenario: Campos del formulario
- **WHEN** una persona abre `/voluntariado`
- **THEN** ve los campos nombre, contacto, mensaje (opcional) y la casilla de consentimiento, y ningún otro dato personal

#### Scenario: Sin cuenta
- **WHEN** una persona sin sesión envía el formulario completo
- **THEN** la inscripción se guarda y no se le pide iniciar sesión ni crear contraseña

### Requirement: Inscripción guardada como apoyante voluntario
Un envío válido SHALL crear, en una sola operación atómica, un apoyante nuevo con rol de voluntario (sin rol de donante y sin marca de anonimato) y una inscripción vinculada a él. Cada envío SHALL crear un apoyante nuevo, sin buscar ni reutilizar apoyantes existentes por nombre ni contacto.

#### Scenario: Envío válido
- **WHEN** se envía nombre "Rosa Quispe", contacto "999 888 777" y el consentimiento marcado
- **THEN** existe un apoyante "Rosa Quispe" con rol voluntario y no donante, con ese contacto, y una inscripción vinculada a él

#### Scenario: Mensaje opcional
- **WHEN** se envía el formulario sin mensaje
- **THEN** la inscripción se guarda y el mensaje queda vacío

#### Scenario: Mismo contacto de un apoyante existente
- **WHEN** el contacto enviado coincide con el de un donante ya registrado
- **THEN** se crea un apoyante nuevo y el donante existente no se modifica ni se revela

#### Scenario: Todo o nada
- **WHEN** falla el guardado de la inscripción después de crear el apoyante
- **THEN** no queda ningún apoyante ni inscripción de ese envío

### Requirement: Consentimiento obligatorio y registrado
El sistema SHALL rechazar un envío sin la casilla de consentimiento marcada y, en un envío válido, SHALL guardar la versión del texto de consentimiento aceptado junto con la fecha de la inscripción. El formulario SHALL mostrar el texto de consentimiento, que explica la finalidad, quién ve los datos y cómo contactar a La FAZ para pedir cambios o la baja, y SHALL indicar que es provisional hasta su revisión legal.

#### Scenario: Sin consentimiento
- **WHEN** se envía el formulario con la casilla sin marcar
- **THEN** no se guarda nada y se muestra el mensaje de que el consentimiento es obligatorio, sin perder lo escrito

#### Scenario: Evidencia del consentimiento
- **WHEN** se guarda una inscripción
- **THEN** queda registrada la versión del texto aceptado y la fecha y hora de la inscripción

#### Scenario: Versión del texto
- **WHEN** se cambia el texto de consentimiento
- **THEN** las inscripciones nuevas guardan la versión nueva y las anteriores conservan la que aceptaron

### Requirement: Validación y límites de longitud
El sistema SHALL validar cada envío en el servidor, sin confiar en el navegador: nombre de 1 a 100 caracteres, contacto de 1 a 200 y mensaje de 0 a 500, después de recortar espacios. Un envío fuera de esos límites SHALL rechazarse sin guardar nada y SHALL devolver un mensaje por campo y lo escrito.

#### Scenario: Nombre o contacto vacíos
- **WHEN** el nombre o el contacto están vacíos o solo tienen espacios
- **THEN** no se guarda nada y cada campo inválido muestra su mensaje

#### Scenario: Texto demasiado largo
- **WHEN** el nombre tiene 101 caracteres, el contacto 201 o el mensaje 501
- **THEN** no se guarda nada y se muestra el límite del campo

#### Scenario: Espacios alrededor
- **WHEN** se envía "  Rosa Quispe  " como nombre
- **THEN** se guarda "Rosa Quispe"

#### Scenario: Se conserva lo escrito
- **WHEN** un envío falla por validación
- **THEN** el formulario sigue mostrando lo que la persona escribió

### Requirement: Campo trampa contra envíos automáticos
El formulario SHALL incluir un campo trampa (honeypot) oculto a las personas y a los lectores de pantalla. Un envío con ese campo lleno SHALL descartarse sin guardar ningún apoyante ni inscripción y SHALL recibir la misma respuesta que un envío válido.

#### Scenario: Campo trampa lleno
- **WHEN** un envío trae el campo trampa con cualquier texto
- **THEN** no se guarda ningún apoyante ni inscripción

#### Scenario: Respuesta indistinguible
- **WHEN** se descarta un envío por el campo trampa
- **THEN** la respuesta es la misma confirmación que ve quien se inscribe de verdad

#### Scenario: Campo trampa invisible
- **WHEN** una persona usa el formulario con teclado o lector de pantalla
- **THEN** el campo trampa no recibe foco ni se anuncia

### Requirement: Confirmación y errores sin datos técnicos
Tras guardar, el sistema SHALL mostrar una confirmación de que la inscripción se recibió. Si la base no responde o falla el guardado, SHALL mostrar un mensaje genérico para reintentar, sin detalles técnicos ni datos de la persona, y el registro del servidor SHALL llevar solo el tipo de error y su código.

#### Scenario: Confirmación
- **WHEN** se guarda una inscripción
- **THEN** la persona ve un mensaje de agradecimiento y que La FAZ la contactará

#### Scenario: Falla la base
- **WHEN** la base no responde al enviar
- **THEN** se muestra un mensaje genérico para reintentar, se conserva lo escrito y no se muestra ningún detalle técnico

#### Scenario: Log sin datos personales
- **WHEN** falla un guardado
- **THEN** el registro del servidor no contiene el nombre, el contacto ni el mensaje enviados

### Requirement: Datos que la inscripción pública no expone
La inscripción pública SHALL ser solo escritura: ninguna respuesta ni página pública SHALL mostrar datos de apoyantes ni de inscripciones, y la inscripción NO SHALL registrar números de cuenta, documentos ni credenciales.

#### Scenario: Respuesta sin datos de otros
- **WHEN** se envía el formulario con cualquier contenido
- **THEN** la respuesta no incluye datos de ningún apoyante ni de otra inscripción

#### Scenario: Sin lectura pública de voluntarios
- **WHEN** se revisan las lecturas de la zona pública
- **THEN** ninguna consulta pública lee apoyantes ni inscripciones
