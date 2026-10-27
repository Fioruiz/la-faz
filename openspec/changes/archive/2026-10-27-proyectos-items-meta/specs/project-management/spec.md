# Spec Delta

## Purpose

Permite que un responsable cree, edite y cierre los proyectos de La FAZ desde la zona privada, con nombres únicos, estado y resultado coherentes y cada cambio registrado en el historial.

## ADDED Requirements

### Requirement: Crear un proyecto
Un responsable activo SHALL poder crear un proyecto con nombre, descripción opcional e indicación de si tiene meta, y el proyecto SHALL quedar en estado `activo`.

#### Scenario: Proyecto con meta
- **WHEN** un responsable crea un proyecto con nombre "Navidad Solidaria" y marca que tiene meta
- **THEN** existe el proyecto en estado `activo`, con meta, y una fila de historial de creación atribuida a ese responsable

#### Scenario: Proyecto informativo
- **WHEN** un responsable crea un proyecto sin marcar que tiene meta
- **THEN** el proyecto existe en estado `activo` y sin meta

#### Scenario: Datos inválidos
- **WHEN** el nombre está vacío o supera 100 caracteres, o la descripción supera 1000
- **THEN** no se crea el proyecto, no queda historial y el formulario muestra el error del campo conservando lo escrito

### Requirement: Nombres de proyecto únicos
El sistema MUST NOT permitir dos proyectos con el mismo nombre, sin distinguir mayúsculas ni espacios al inicio y al final.

#### Scenario: Nombre repetido al crear
- **WHEN** un responsable crea un proyecto llamado "música" y ya existe "Música"
- **THEN** no se crea, no queda historial y se muestra el mensaje "Ya existe un proyecto con ese nombre"

#### Scenario: Nombre repetido al editar
- **WHEN** un responsable renombra un proyecto con el nombre de otro
- **THEN** el nombre no cambia y se muestra el mismo mensaje

### Requirement: Editar un proyecto activo
Un responsable activo SHALL poder editar el nombre, la descripción y la indicación de meta de un proyecto en estado `activo`, y cada edición SHALL registrar los valores anteriores y nuevos.

#### Scenario: Edición con cambios
- **WHEN** un responsable cambia la descripción de un proyecto activo
- **THEN** la descripción queda actualizada y el historial guarda la descripción anterior y la nueva

#### Scenario: Edición sin cambios
- **WHEN** un responsable guarda el formulario sin cambiar ningún valor
- **THEN** no se escribe nada y se muestra el mensaje "No hay cambios para guardar"

#### Scenario: Proyecto con ítems no puede dejar de tener meta
- **WHEN** un responsable quita la meta a un proyecto que ya tiene ítems
- **THEN** no se guarda y se muestra un mensaje que explica que un proyecto con ítems no puede quedar sin meta

#### Scenario: Proyecto inexistente
- **WHEN** se edita un proyecto que no existe
- **THEN** no se escribe nada y se muestra un mensaje de proyecto no encontrado

### Requirement: Finalizar un proyecto con su resultado
Un responsable activo SHALL poder finalizar un proyecto `activo` indicando su resultado, y el proyecto SHALL quedar en estado `finalizado` con ese resultado.

#### Scenario: Cierre con resultado
- **WHEN** un responsable finaliza un proyecto activo con el resultado "Se entregaron 1850 packs"
- **THEN** el proyecto queda `finalizado` con ese resultado y el historial registra la finalización con el estado anterior y el nuevo

#### Scenario: Resultado obligatorio
- **WHEN** se intenta finalizar con el resultado vacío o de más de 2000 caracteres
- **THEN** el proyecto sigue activo, no queda historial y se muestra el error del campo

#### Scenario: Proyecto ya finalizado
- **WHEN** se intenta finalizar un proyecto que ya está finalizado
- **THEN** no cambia nada y se muestra que el proyecto ya está finalizado

#### Scenario: Metas sin cumplir
- **WHEN** un proyecto finaliza con ítems cuya meta no se alcanzó
- **THEN** el cierre se permite

### Requirement: Un proyecto finalizado es de solo lectura
Un proyecto `finalizado` MUST NOT poder editarse ni reabrirse, y SHALL mostrarse como "Finalizado" junto con su resultado.

#### Scenario: Editar un proyecto finalizado
- **WHEN** se intenta editar el nombre, la descripción o la meta de un proyecto finalizado
- **THEN** no cambia nada y se muestra que el proyecto está finalizado

#### Scenario: Visualización
- **WHEN** un responsable abre un proyecto finalizado
- **THEN** ve el estado "Finalizado", el resultado, y no ve formularios de edición ni de cierre

### Requirement: Lista y detalle de proyectos privados
La zona privada SHALL mostrar la lista de todos los proyectos con su estado y si tienen meta, y la página de cada proyecto con sus datos e ítems, y ambas lecturas MUST pasar por el módulo de acceso privado.

#### Scenario: Lista
- **WHEN** un responsable activo abre la lista de proyectos
- **THEN** ve todos los proyectos, activos y finalizados, con su estado

#### Scenario: Responsable desactivado
- **WHEN** un responsable desactivado con sesión vigente pide la lista o un proyecto
- **THEN** no recibe ningún dato y es llevado al login

#### Scenario: Proyecto inexistente en la página
- **WHEN** un responsable abre la página de un proyecto que no existe
- **THEN** ve una página de no encontrado
