# responsable-access Specification

## Purpose

Define quién puede entrar a la zona privada de La FAZ y cómo se revoca ese acceso: solo un responsable activo, comprobado contra la base en cada petición privada y no solo al iniciar sesión.

## Requirements

### Requirement: Inicio de sesión con correo y contraseña
El sistema SHALL permitir que un responsable con `activo = true` inicie sesión con su correo y su contraseña y lo SHALL llevar a la zona privada.

#### Scenario: Credenciales correctas de un responsable activo
- **WHEN** un responsable activo envía su correo y su contraseña correctos en el formulario de login
- **THEN** se crea su sesión y llega a la página principal de la zona privada, que muestra su nombre

#### Scenario: Contraseña incorrecta
- **WHEN** se envía un correo existente con una contraseña incorrecta
- **THEN** no se crea sesión y el login muestra un mensaje de credenciales inválidas

#### Scenario: Correo inexistente
- **WHEN** se envía un correo que no pertenece a ningún responsable
- **THEN** no se crea sesión y el login muestra el mismo mensaje de credenciales inválidas que para una contraseña incorrecta

#### Scenario: Entrada mal formada
- **WHEN** se envía el formulario con el correo o la contraseña vacíos, o con un correo sin formato válido
- **THEN** no se crea sesión, no se consulta la contraseña de ningún responsable y el login muestra un mensaje de datos inválidos

### Requirement: Un responsable desactivado no inicia sesión
El sistema MUST NOT crear sesión para un responsable con `activo = false`, aunque su correo y su contraseña sean correctos, y SHALL conservar sus registros.

#### Scenario: Intento de login de un responsable desactivado
- **WHEN** un responsable con `activo = false` envía su correo y su contraseña correctos
- **THEN** no se crea sesión y el login muestra el mismo mensaje de credenciales inválidas

#### Scenario: Sus registros se conservan
- **WHEN** un responsable queda desactivado
- **THEN** su fila en `responsables` y las filas que lo referencian siguen existiendo

### Requirement: La sesión no mantiene datos del responsable
La sesión SHALL identificar al responsable solo por su id y MUST NOT usarse para decidir permisos ni para mostrar datos del responsable guardados en ella.

#### Scenario: Contenido de la sesión
- **WHEN** se inspecciona el contenido de una sesión recién creada
- **THEN** contiene el id del responsable y no contiene el correo, el hash de la contraseña ni el estado `activo`

#### Scenario: Cambio de nombre posterior
- **WHEN** el nombre del responsable cambia en la base después de iniciar sesión
- **THEN** la zona privada muestra el nombre actual de la base en la siguiente petición

### Requirement: Comprobación del responsable activo en cada acceso privado
Toda lectura y toda escritura de la zona privada SHALL comprobar en la base, antes de cualquier otra operación, que el responsable de la sesión existe y está activo. Esto incluye las páginas y las Server Actions, no solo estas últimas.

#### Scenario: Responsable activo
- **WHEN** una petición privada llega con una sesión cuyo responsable existe y está activo
- **THEN** la operación se ejecuta y conoce el id del responsable

#### Scenario: Petición sin sesión
- **WHEN** una operación privada se invoca sin sesión
- **THEN** se rechaza sin consultar ninguna otra tabla

#### Scenario: Responsable inexistente
- **WHEN** una operación privada se invoca con una sesión cuyo id ya no existe en `responsables`
- **THEN** se rechaza y no se devuelve ningún dato

### Requirement: Revocación inmediata de un responsable desactivado
Un responsable que se desactiva con una sesión aún vigente SHALL ser rechazado en su siguiente petición privada, sin esperar a que caduque la sesión.

#### Scenario: Página privada tras la desactivación
- **WHEN** un responsable inicia sesión, otro lo desactiva, y el primero vuelve a cargar una página privada
- **THEN** no ve los datos de la página y es llevado al login

#### Scenario: Cada ruta privada rechaza al desactivado
- **WHEN** se invoca cada ruta privada existente (página y acción) con la sesión de un responsable desactivado
- **THEN** todas rechazan la petición y ninguna devuelve datos

#### Scenario: Reactivación
- **WHEN** un responsable desactivado vuelve a tener `activo = true`
- **THEN** puede iniciar sesión de nuevo y sus registros anteriores siguen asociados a él

### Requirement: Redirección al login de quien no tiene sesión
El sistema SHALL redirigir al login a quien solicita una ruta de la zona privada sin sesión. Esta redirección SHALL ser un filtro de comodidad y MUST NOT ser la única comprobación de acceso.

#### Scenario: Visitante sin sesión pide una página privada
- **WHEN** alguien sin sesión solicita la página principal de la zona privada
- **THEN** es redirigido al login

#### Scenario: Las páginas públicas no se redirigen
- **WHEN** alguien sin sesión solicita la portada pública o el login
- **THEN** la página se muestra sin redirección

#### Scenario: Con sesión en el login
- **WHEN** un responsable con sesión vigente abre el login
- **THEN** es llevado a la zona privada

### Requirement: Acceso a datos privados solo por el módulo de acceso
Los componentes y las acciones de la zona privada MUST NOT consultar tablas directamente. Toda lectura y escritura privada SHALL pasar por el módulo de acceso privado, cuya primera operación es la comprobación del responsable activo.

#### Scenario: Componente privado que importa la base
- **WHEN** se revisa el código de la zona privada
- **THEN** ninguna página, layout ni componente privado importa el cliente de base de datos ni el esquema

### Requirement: Caducidad y cierre de sesión
Las sesiones SHALL caducar a los 7 días, y un responsable SHALL poder cerrar su sesión desde la zona privada. La caducidad MUST NOT ser el mecanismo de revocación.

#### Scenario: Sesión más antigua que 7 días
- **WHEN** se presenta una sesión creada hace más de 7 días
- **THEN** se trata como si no hubiera sesión y se redirige al login

#### Scenario: Cierre de sesión
- **WHEN** un responsable cierra su sesión y vuelve a pedir una página privada
- **THEN** es redirigido al login

### Requirement: Los errores no revelan datos
Los mensajes de error del login y de la zona privada MUST NOT revelar si un correo existe, si un responsable está desactivado, ni contraseñas, hashes o cadenas de conexión.

#### Scenario: Mensajes del login
- **WHEN** falla un login por cualquier causa (contraseña incorrecta, correo inexistente, responsable desactivado)
- **THEN** el mensaje mostrado es el mismo en los tres casos

#### Scenario: Falla la base durante el login
- **WHEN** la base no responde durante un intento de login
- **THEN** el usuario ve un mensaje genérico de error, sin la cadena de conexión ni el texto del error de la base
