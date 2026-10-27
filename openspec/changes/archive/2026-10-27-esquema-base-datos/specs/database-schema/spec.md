# Spec Delta

## Purpose

Define las entidades que la base de datos de La FAZ guarda y las reglas de integridad que la propia base hace cumplir, de modo que ninguna escritura incoherente pueda alterar el avance de las metas ni perder registros.

## ADDED Requirements

### Requirement: Entidades del sistema
La base SHALL contener las tablas `responsables`, `proyectos`, `items_meta`, `apoyantes`, `donaciones`, `voluntarios_inscritos` y `audit_log`, con las columnas que el TDD v2 asigna a cada una.

#### Scenario: Esquema completo tras migrar
- **WHEN** se aplican las migraciones sobre una base vacía
- **THEN** existen las siete tablas, cada una con las columnas del TDD v2, y la aplicación del esquema termina sin error

### Requirement: Migraciones versionadas y repetibles
El esquema SHALL aplicarse mediante migraciones guardadas en el repositorio, y volver a ejecutar la migración sobre una base ya migrada MUST NOT modificar ni duplicar nada.

#### Scenario: Migración repetida
- **WHEN** se ejecuta el comando de migración dos veces seguidas sobre la misma base
- **THEN** la segunda ejecución termina sin error y sin cambios

#### Scenario: Esquema y migración alineados
- **WHEN** se pide a la herramienta de migraciones que detecte diferencias entre la definición del esquema y las migraciones guardadas
- **THEN** no reporta ninguna diferencia

### Requirement: Estados y valores permitidos
La base SHALL rechazar un estado de proyecto distinto de `activo` o `finalizado`, un medio de pago fuera de Yape, Plin y transferencia, un tipo de donación distinto de `dinero` o `producto`, y una meta o un costo referencial no positivos.

#### Scenario: Estado de proyecto inválido
- **WHEN** se inserta un proyecto con estado `cerrado`
- **THEN** la base rechaza la inserción

#### Scenario: Meta no positiva
- **WHEN** se inserta un ítem con `cantidad_meta` igual a 0
- **THEN** la base rechaza la inserción

#### Scenario: Costo referencial ausente
- **WHEN** se inserta un ítem sin `costo_referencial`
- **THEN** la base acepta la inserción y el costo queda nulo

### Requirement: Un ítem pertenece a un solo proyecto
La base SHALL impedir que una donación combine un ítem con un proyecto distinto del proyecto al que pertenece ese ítem.

#### Scenario: Ítem de otro proyecto
- **WHEN** se inserta una donación en producto con `proyecto_id` de un proyecto A e `item_id` de un ítem del proyecto B
- **THEN** la base rechaza la inserción

#### Scenario: Ítem de su propio proyecto
- **WHEN** se inserta una donación en producto con un ítem y el proyecto al que ese ítem pertenece
- **THEN** la base acepta la inserción

### Requirement: Tres estados válidos de donación
La base SHALL aceptar solo tres combinaciones en `donaciones`: dinero con `monto` positivo y sin `item_id` ni `cantidad`; producto asignado con `cantidad` positiva y con `item_id` y `proyecto_id`; y producto sin asignar con `cantidad` positiva, `item_id` y `proyecto_id` nulos y `descripcion_producto` no nula.

#### Scenario: Dinero sin asignar
- **WHEN** se inserta una donación en dinero con monto positivo y sin proyecto
- **THEN** la base acepta la inserción

#### Scenario: Dinero sin monto positivo
- **WHEN** se inserta una donación en dinero con monto 0, negativo o nulo
- **THEN** la base rechaza la inserción

#### Scenario: Dinero con ítem o cantidad
- **WHEN** se inserta una donación en dinero que también trae `item_id` o `cantidad`
- **THEN** la base rechaza la inserción

#### Scenario: Producto asignado válido
- **WHEN** se inserta una donación en producto con cantidad positiva, ítem y proyecto coherentes
- **THEN** la base acepta la inserción

#### Scenario: Producto con cantidad no positiva
- **WHEN** se inserta una donación en producto con cantidad 0 o negativa
- **THEN** la base rechaza la inserción

#### Scenario: Producto con ítem pero sin proyecto
- **WHEN** se inserta una donación en producto con `item_id` y `proyecto_id` nulo
- **THEN** la base rechaza la inserción

#### Scenario: Producto con proyecto pero sin ítem
- **WHEN** se inserta una donación en producto con `proyecto_id` y `item_id` nulo
- **THEN** la base rechaza la inserción

#### Scenario: Producto sin asignar con descripción
- **WHEN** se inserta una donación en producto con cantidad positiva, sin ítem ni proyecto y con `descripcion_producto`
- **THEN** la base acepta la inserción

#### Scenario: Producto sin asignar sin descripción
- **WHEN** se inserta una donación en producto sin ítem ni proyecto y con `descripcion_producto` nula
- **THEN** la base rechaza la inserción

### Requirement: Anulación sin borrado
Una donación SHALL tener un indicador de anulación que por defecto es falso, y la base MUST conservar la fila de una donación anulada.

#### Scenario: Valor por defecto
- **WHEN** se inserta una donación sin indicar el indicador de anulación
- **THEN** la donación queda con `anulada` en falso

#### Scenario: Anular conserva la fila
- **WHEN** se marca una donación como anulada
- **THEN** la fila sigue existiendo con su apoyante, proyecto y valores originales

### Requirement: Registros ligados a quien los creó
Cada donación SHALL guardar el responsable que la registró, y desactivar a un responsable MUST NOT borrar ni modificar las donaciones que registró.

#### Scenario: Donación sin responsable
- **WHEN** se inserta una donación sin `registrado_por`
- **THEN** la base rechaza la inserción

#### Scenario: Responsable desactivado
- **WHEN** se pone `activo` en falso a un responsable que registró donaciones
- **THEN** sus donaciones siguen presentes y sin cambios

#### Scenario: Responsable activo por defecto
- **WHEN** se inserta un responsable sin indicar `activo`
- **THEN** queda activo

### Requirement: Donación mixta vinculada
Una donación SHALL poder apuntar a otra donación mediante `donacion_vinculada_id`, y ese vínculo MUST referirse a una donación existente.

#### Scenario: Vínculo válido
- **WHEN** se inserta una donación en producto con `donacion_vinculada_id` de una donación en dinero existente
- **THEN** la base acepta la inserción

#### Scenario: Vínculo a una donación inexistente
- **WHEN** se inserta una donación con un `donacion_vinculada_id` que no existe
- **THEN** la base rechaza la inserción

### Requirement: Apoyantes con rol y anonimato público
Un apoyante SHALL guardar nombre, contacto, si es donante, si es voluntario y si debe mostrarse como anónimo en lo público, y la base MUST rechazar un apoyante que no sea donante ni voluntario.

#### Scenario: Apoyante sin rol
- **WHEN** se inserta un apoyante que no es donante ni voluntario
- **THEN** la base rechaza la inserción

#### Scenario: Anonimato por defecto
- **WHEN** se inserta un apoyante sin indicar `anonimo_publico`
- **THEN** queda en falso

### Requirement: Historial de cambios
La base SHALL tener una tabla `audit_log` capaz de guardar entidad, identificador, acción, valores antes y después, responsable y fecha. Este cambio no escribe en ella.

#### Scenario: Fila de historial completa
- **WHEN** se inserta una fila de historial con entidad, identificador, acción, responsable y valores en JSON
- **THEN** la base la acepta y la fecha se completa automáticamente

#### Scenario: Historial sin responsable
- **WHEN** se inserta una fila de historial sin responsable
- **THEN** la base rechaza la inserción

### Requirement: Inscripciones de voluntariado vinculadas
Cada inscripción en `voluntarios_inscritos` SHALL estar vinculada a un apoyante existente.

#### Scenario: Inscripción con apoyante
- **WHEN** se inserta una inscripción con un apoyante existente
- **THEN** la base la acepta

#### Scenario: Inscripción sin apoyante
- **WHEN** se inserta una inscripción con un apoyante inexistente o nulo
- **THEN** la base la rechaza
