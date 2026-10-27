# Spec Delta

## Purpose

Frena los intentos repetidos de adivinar contraseñas y el envío masivo del formulario público de voluntariado, sin servicios externos y sin revelar qué correos pertenecen a responsables.

## ADDED Requirements

### Requirement: Bloqueo temporal del login por correo
Tras 5 intentos de inicio de sesión para un mismo correo dentro de 15 minutos, el sistema SHALL rechazar el siguiente sin comprobar la contraseña, aunque sea correcta, mientras haya más de 5 intentos del correo en esa ventana. Cada intento se registra antes de comprobar la contraseña, de modo que peticiones simultáneas no superan el tope. El límite SHALL aplicarse a cualquier vía de inicio de sesión, incluidas las llamadas directas al servicio de autenticación.

#### Scenario: Quinto fallo
- **WHEN** hay 5 intentos fallidos de un correo en 15 minutos
- **THEN** el intento siguiente se rechaza sin comprobar la contraseña y se informa de que debe esperar

#### Scenario: Contraseña correcta durante el bloqueo
- **WHEN** un responsable activo escribe su contraseña correcta mientras su correo está bloqueado
- **THEN** no inicia sesión

#### Scenario: Termina el bloqueo
- **WHEN** los intentos salen de la ventana de 15 minutos y quedan 5 o menos dentro de ella
- **THEN** el correo puede intentar iniciar sesión de nuevo

#### Scenario: Peticiones simultáneas
- **WHEN** llegan 20 intentos a la vez con contraseñas distintas para un mismo correo
- **THEN** como mucho 5 llegan a comprobar la contraseña y el resto se rechaza

#### Scenario: Llamada directa
- **WHEN** se hacen los intentos llamando directamente al servicio de autenticación en lugar del formulario
- **THEN** el límite se aplica igual

### Requirement: Un acierto limpia los fallos
Un inicio de sesión correcto SHALL borrar los intentos fallidos de ese correo, de modo que un uso normal no acumule bloqueos.

#### Scenario: Acierto tras fallos
- **WHEN** un responsable falla 3 veces y luego entra con su contraseña correcta
- **THEN** entra, y sus fallos anteriores ya no cuentan

### Requirement: Sin revelar qué correos existen
El límite SHALL contarse igual para correos que pertenecen a responsables y para los que no, con el mismo mensaje y el mismo tiempo de bloqueo.

#### Scenario: Correo inexistente
- **WHEN** hay 5 intentos fallidos con un correo que no es de ningún responsable
- **THEN** se bloquea exactamente igual que uno existente

#### Scenario: Mensajes
- **WHEN** se compara el mensaje de un correo existente bloqueado con el de uno inexistente bloqueado
- **THEN** son idénticos

### Requirement: Límite de envíos del formulario público
El formulario de voluntariado SHALL aceptar como máximo 5 envíos por hora desde una misma dirección IP. Un envío por encima del límite SHALL rechazarse sin guardar nada, con un mensaje que pida intentar más tarde y conserve lo escrito.

#### Scenario: Sexto envío
- **WHEN** una misma IP hace un sexto envío en una hora
- **THEN** no se guarda ningún apoyante ni inscripción y se muestra el mensaje de espera

#### Scenario: IPv6 por prefijo
- **WHEN** envíos vienen de distintas direcciones IPv6 dentro de un mismo prefijo /64
- **THEN** cuentan como una sola IP para el límite

#### Scenario: Otra IP
- **WHEN** otra IP envía el formulario mientras la primera está limitada
- **THEN** su envío se procesa con normalidad

#### Scenario: Envíos descartados por el campo trampa
- **WHEN** un envío se descarta por el campo trampa
- **THEN** también cuenta para el límite de esa IP

#### Scenario: Envíos con errores de validación
- **WHEN** un envío falla la validación
- **THEN** también cuenta para el límite, para que no se use para sondear

### Requirement: La IP no se guarda en claro
La dirección IP SHALL guardarse solo como un resumen irreversible con clave secreta, nunca en texto. Los contadores SHALL borrarse pasado el doble de su ventana y NO SHALL guardar contraseñas ni datos del formulario.

#### Scenario: Contenido del contador
- **WHEN** se inspecciona la tabla de contadores tras varios envíos
- **THEN** no contiene ninguna IP legible, ningún nombre ni contacto ni contraseña

#### Scenario: Limpieza
- **WHEN** se registra un intento nuevo
- **THEN** los contadores con más del doble de la ventana se eliminan

### Requirement: Falla del contador
Si la base no responde al consultar o registrar un intento, el sistema SHALL rechazar el intento con un mensaje genérico y NO SHALL permitir el acceso ni guardar el envío sin contarlo.

#### Scenario: Base caída en el login
- **WHEN** falla la consulta del límite de login
- **THEN** no se inicia sesión y se muestra el error genérico

#### Scenario: Base caída en el formulario
- **WHEN** falla la consulta del límite del formulario
- **THEN** no se guarda nada y se muestra el error genérico, conservando lo escrito
