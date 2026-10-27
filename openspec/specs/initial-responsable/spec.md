# initial-responsable Specification

## Purpose

Garantiza que exista un primer responsable que pueda entrar al sistema sin pantalla de gestión de usuarios, creado desde fuera de la aplicación y sin que ninguna contraseña quede en el repositorio.

## Requirements

### Requirement: Creación del responsable inicial por script
El sistema SHALL ofrecer un script que cree un responsable activo a partir del nombre, el correo y la contraseña indicados en variables de entorno, y que guarde la contraseña solo como hash.

#### Scenario: Base sin responsables
- **WHEN** se ejecuta el script con las tres variables definidas sobre una base sin responsables
- **THEN** existe exactamente un responsable con ese nombre y correo, con `activo = true`, y su contraseña se guarda como hash distinto del texto original

#### Scenario: El responsable creado puede iniciar sesión
- **WHEN** se ejecuta el script y luego se inicia sesión con ese correo y esa contraseña
- **THEN** el inicio de sesión tiene éxito

### Requirement: Ejecución repetible sin cambiar un responsable existente
Ejecutar el script otra vez MUST NOT duplicar al responsable ni sobrescribir su contraseña, su nombre ni su estado `activo`.

#### Scenario: Segunda ejecución
- **WHEN** se ejecuta el script dos veces con las mismas variables
- **THEN** sigue habiendo un único responsable con ese correo

#### Scenario: Responsable desactivado y script repetido
- **WHEN** el responsable inicial fue desactivado y se vuelve a ejecutar el script
- **THEN** sigue desactivado

#### Scenario: Contraseña cambiada en el entorno
- **WHEN** el responsable ya existe y se ejecuta el script con otra contraseña en la variable
- **THEN** la contraseña guardada no cambia y el script informa que el responsable ya existía

### Requirement: Entrada obligatoria y validada
El script MUST rechazar la ejecución, sin escribir en la base, si falta alguna de las tres variables, si el correo no tiene formato válido o si la contraseña no cumple una longitud mínima de 12 caracteres.

#### Scenario: Falta una variable
- **WHEN** se ejecuta el script sin la variable de la contraseña
- **THEN** termina con error que nombra la variable faltante, sin imprimir ningún valor, y no se crea ninguna fila

#### Scenario: Contraseña demasiado corta
- **WHEN** la contraseña tiene menos de 12 caracteres
- **THEN** termina con error que indica la longitud mínima y no se crea ninguna fila

### Requirement: Sin secretos en el repositorio ni en la salida
La contraseña y su hash MUST NOT aparecer en archivos versionados, en la salida del script ni en los registros de la aplicación, y el repositorio MUST NOT contener un responsable ni una contraseña por defecto.

#### Scenario: Salida del script
- **WHEN** el script termina, con éxito o con error
- **THEN** la salida no contiene la contraseña, el hash ni la cadena de conexión

#### Scenario: Archivos versionados
- **WHEN** se revisan los archivos versionados
- **THEN** las variables del responsable inicial aparecen solo vacías en `.env.example` y ningún archivo contiene una contraseña real

### Requirement: Solo escribe el responsable
El script MUST NOT crear ni modificar filas de ninguna tabla distinta de `responsables`.

#### Scenario: Otras tablas
- **WHEN** se ejecuta el script sobre una base migrada
- **THEN** las tablas distintas de `responsables` no cambian
