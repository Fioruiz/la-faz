# Spec Delta

## Purpose

Garantiza desde la propia base de datos que la zona pública no puede leer datos personales, contactos, historial ni responsables, aunque un error de código intente consultarlos.

## ADDED Requirements

### Requirement: Rol de solo lectura para la zona pública
Las lecturas de la zona pública SHALL usar una conexión a Postgres con un rol propio que solo puede leer, y NO SHALL poder insertar, modificar ni borrar en ninguna tabla.

#### Scenario: Lectura permitida
- **WHEN** la zona pública pide los proyectos y su avance con ese rol
- **THEN** la consulta se ejecuta y devuelve los mismos datos que la zona privada

#### Scenario: Escritura rechazada
- **WHEN** ese rol intenta insertar, actualizar o borrar en cualquier tabla
- **THEN** la base rechaza la operación por falta de permiso

### Requirement: Sin acceso a datos personales ni internos
El rol público SHALL NOT tener permiso de lectura sobre las tablas de apoyantes, voluntarios inscritos, responsables ni historial de cambios, ni sobre las columnas de donaciones que identifican a la persona o describen el producto sin asignar.

#### Scenario: Tablas con datos personales
- **WHEN** el rol público consulta apoyantes, voluntarios inscritos, responsables o historial
- **THEN** la base rechaza la consulta por falta de permiso

#### Scenario: Columnas personales de donaciones
- **WHEN** el rol público selecciona el apoyante, el registrador, el medio o la descripción del producto de una donación
- **THEN** la base rechaza la consulta por falta de permiso

#### Scenario: Consulta de avance intacta
- **WHEN** el rol público ejecuta la consulta de avance compartida con la zona privada
- **THEN** se ejecuta sin error de permiso y da las mismas cifras que con la conexión de la aplicación

### Requirement: La conexión pública es obligatoria y separada
La zona pública SHALL leer solo por la conexión del rol público. Si esa conexión no está configurada, la zona pública SHALL fallar de forma visible y NO SHALL usar la conexión de la aplicación como sustituto.

#### Scenario: Sin configuración
- **WHEN** falta la cadena de conexión del rol público
- **THEN** las páginas públicas de proyectos muestran la página de error, sin avance en cero

#### Scenario: Una sola vía
- **WHEN** se revisa el código de la zona pública
- **THEN** ningún archivo público obtiene la conexión de la aplicación ni la del rol privado

### Requirement: Creación del rol sin secretos en el repositorio
El rol y sus permisos SHALL crearse con un comando repetible que lee la contraseña de una variable de entorno. La contraseña NO SHALL aparecer en el repositorio, en migraciones ni en la salida del comando.

#### Scenario: Repetible
- **WHEN** el comando se ejecuta dos veces
- **THEN** la segunda vez no falla ni cambia los permisos

#### Scenario: Sin la contraseña
- **WHEN** falta la variable con la contraseña
- **THEN** el comando termina con un mensaje claro y no crea nada

#### Scenario: Sin el entorno de producción por accidente
- **WHEN** el comando apunta a la base real
- **THEN** exige una confirmación explícita antes de escribir

#### Scenario: Prueba que en realidad es producción
- **WHEN** se usa la opción de pruebas y la cadena de pruebas apunta al mismo servidor que la base real
- **THEN** el comando se niega y no escribe nada

### Requirement: Lo que sale en público no cambia
Con el rol de solo lectura, las páginas públicas de proyectos SHALL mostrar las mismas cifras y el mismo contenido que antes, sin dinero, sin donantes y con la barra limitada al 100%.

#### Scenario: Igualdad con el avance privado
- **WHEN** se compara el avance público con el privado para los mismos proyectos
- **THEN** cada ítem coincide, limitado a la meta
