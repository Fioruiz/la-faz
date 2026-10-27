# database-connection Specification

## Purpose

Define cómo la aplicación se conecta a Postgres en Neon: un único punto de conexión, con soporte de transacciones y fallo claro cuando falta la configuración.

## Requirements

### Requirement: Conexión única a Neon Postgres
El sistema SHALL acceder a Postgres en Neon a través de un único módulo de conexión, con una sola cadena de conexión y un solo rol.

#### Scenario: Conexión correcta
- **WHEN** existe una cadena de conexión válida y se ejecuta el comando de verificación de la conexión
- **THEN** el comando ejecuta una consulta trivial en Neon, informa que la conexión funciona y termina con código 0

### Requirement: Transacciones interactivas
El sistema SHALL permitir transacciones interactivas, de modo que un cambio y su registro de historial puedan guardarse juntos o no guardarse.

#### Scenario: Transacción confirmada
- **WHEN** se ejecutan dos operaciones dentro de una transacción y ambas terminan sin error
- **THEN** ambos resultados quedan confirmados

#### Scenario: Transacción revertida
- **WHEN** una transacción lanza un error después de su primera operación
- **THEN** ninguna de las operaciones de esa transacción queda guardada

### Requirement: Fallo claro sin configuración
El sistema SHALL fallar con un mensaje que nombre la variable ausente cuando falte la cadena de conexión, sin mostrar su valor.

#### Scenario: Variable ausente
- **WHEN** se ejecuta el comando de verificación o se intenta usar la conexión sin la variable de la cadena de conexión
- **THEN** el proceso termina con error y el mensaje nombra la variable que falta, sin imprimir ninguna cadena de conexión

### Requirement: Sin rutas públicas que consulten la base
El sistema SHALL NOT exponer en este ítem ninguna ruta pública que lea tablas; la página inicial provisional no consulta la base de datos.

#### Scenario: Página inicial sin consultas
- **WHEN** se visita la página inicial
- **THEN** responde sin abrir conexión a la base de datos y sin mostrar datos de ella
