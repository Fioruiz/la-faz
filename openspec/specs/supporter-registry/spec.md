# supporter-registry Specification

## Purpose

Permite que un responsable lleve el registro de las personas que apoyan a La FAZ, donantes y voluntarios, con búsqueda para encontrarlas y cada cambio en el historial.

## Requirements

### Requirement: Crear un apoyante
Un responsable activo SHALL poder crear un apoyante con nombre, contacto opcional, al menos un rol (donante, voluntario o ambos) y la marca de anonimato público.

#### Scenario: Donante
- **WHEN** un responsable crea un apoyante con nombre "Rosa Quispe" y el rol donante
- **THEN** existe el apoyante como donante, no voluntario y no anónimo, con historial de creación atribuido al responsable

#### Scenario: Donante y voluntario
- **WHEN** se crea un apoyante con ambos roles
- **THEN** queda con los dos roles

#### Scenario: Sin rol
- **WHEN** se intenta crear un apoyante sin ningún rol
- **THEN** no se crea, no queda historial y se muestra el error "Elige al menos un rol"

#### Scenario: Datos inválidos
- **WHEN** el nombre está vacío o supera 100 caracteres, o el contacto supera 200
- **THEN** no se crea, no queda historial y el formulario muestra el error del campo conservando lo escrito

### Requirement: Nombres de apoyante no únicos
El sistema SHALL permitir dos apoyantes con el mismo nombre, porque dos personas distintas pueden llamarse igual.

#### Scenario: Mismo nombre
- **WHEN** se crea un apoyante con el nombre de otro apoyante existente
- **THEN** se crea como un registro distinto

### Requirement: Editar un apoyante
Un responsable activo SHALL poder editar el nombre, el contacto, los roles y la marca de anonimato de un apoyante, y cada edición SHALL quedar en el historial.

#### Scenario: Cambio de nombre
- **WHEN** un responsable corrige el nombre de un apoyante
- **THEN** el nombre queda actualizado y el historial registra el nombre anterior y el nuevo

#### Scenario: Sin cambios
- **WHEN** se guarda el formulario sin cambiar ningún valor
- **THEN** no se escribe nada y se muestra "No hay cambios para guardar"

#### Scenario: Apoyante inexistente
- **WHEN** se edita un apoyante que no existe
- **THEN** no se escribe nada y se muestra que no se encontró

#### Scenario: Siguen sin rol
- **WHEN** una edición dejaría al apoyante sin ningún rol
- **THEN** no se guarda y se muestra "Elige al menos un rol"

### Requirement: Los roles con registros asociados no se pueden quitar
El sistema MUST NOT permitir quitar el rol de donante a un apoyante que ya tiene donaciones, ni el de voluntario a uno que ya tiene inscripciones de voluntariado.

#### Scenario: Donante con donaciones
- **WHEN** se quita el rol donante a un apoyante con al menos una donación
- **THEN** no se guarda y se muestra que ya tiene donaciones registradas

#### Scenario: Voluntario con inscripciones
- **WHEN** se quita el rol voluntario a un apoyante con al menos una inscripción
- **THEN** no se guarda y se muestra que ya tiene inscripciones

#### Scenario: Sin registros asociados
- **WHEN** se quita un rol a un apoyante sin registros de ese tipo y le queda otro rol
- **THEN** el cambio se guarda

### Requirement: Lista y búsqueda de apoyantes
La zona privada SHALL mostrar la lista de apoyantes ordenada por nombre, con búsqueda por nombre que no distinga mayúsculas ni tildes y filtro por rol, y la lista MUST NOT mostrar el contacto.

#### Scenario: Búsqueda sin tildes
- **WHEN** un responsable busca "perez" y existe el apoyante "Ana Pérez"
- **THEN** aparece "Ana Pérez" en los resultados

#### Scenario: Filtro por rol
- **WHEN** se filtra por voluntarios
- **THEN** solo aparecen apoyantes con el rol voluntario, incluidos los que también son donantes

#### Scenario: Búsqueda con caracteres especiales
- **WHEN** se busca un texto con `%`, `_` o comillas
- **THEN** se trata como texto literal y no devuelve todos los registros ni produce error

#### Scenario: Sin resultados
- **WHEN** ninguna persona coincide
- **THEN** se muestra un mensaje de que no hay resultados

#### Scenario: Muchos resultados
- **WHEN** hay más de 200 coincidencias
- **THEN** se muestran las primeras 200 y un aviso de que se acote la búsqueda

### Requirement: Acceso solo para responsables activos
Toda lectura y escritura de apoyantes SHALL pasar por el acceso privado y comprobar al responsable activo.

#### Scenario: Responsable desactivado
- **WHEN** un responsable desactivado con sesión vigente pide la lista, un apoyante o intenta crear o editar
- **THEN** no recibe datos, no se escribe nada y es llevado al login

#### Scenario: Sin sesión
- **WHEN** alguien sin sesión pide cualquier página de apoyantes
- **THEN** es redirigido al login

### Requirement: Los apoyantes no se borran
El sistema MUST NOT ofrecer ni ejecutar el borrado de apoyantes.

#### Scenario: Sin borrado
- **WHEN** se revisa la interfaz y las acciones de apoyantes
- **THEN** no existe ninguna operación que elimine filas de `apoyantes`
