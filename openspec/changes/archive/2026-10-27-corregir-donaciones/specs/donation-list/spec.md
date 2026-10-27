# Spec Delta

## Purpose

Da un punto de entrada para llegar a cada donación registrada y corregirla: una lista mínima y una página de detalle. No es el reporte con totales, que es otro ítem.

## ADDED Requirements

### Requirement: Lista de donaciones
La zona privada SHALL mostrar las donaciones ordenadas de la más reciente a la más antigua (por fecha y luego por registro), con tipo, monto o cantidad, proyecto o "Sin asignar", donante y estado, mostrando como máximo 100.

#### Scenario: Orden
- **WHEN** se abre la lista
- **THEN** las donaciones aparecen de la fecha más reciente a la más antigua y, dentro de una fecha, de la última registrada a la primera

#### Scenario: Muchas donaciones
- **WHEN** hay más de 100 coincidencias
- **THEN** se muestran las primeras 100 y un aviso de que se acote la búsqueda

#### Scenario: Sin donaciones
- **WHEN** no hay donaciones
- **THEN** se muestra un mensaje de que todavía no hay

### Requirement: Filtros mínimos y búsqueda por donante
La lista SHALL ofrecer los filtros "Todas", "Sin asignar" y "Anuladas", y una búsqueda por nombre del donante que no distinga mayúsculas ni tildes.

#### Scenario: Sin asignar
- **WHEN** se filtra por "Sin asignar"
- **THEN** aparecen solo las donaciones sin proyecto que no están anuladas

#### Scenario: Anuladas
- **WHEN** se filtra por "Anuladas"
- **THEN** aparecen solo las anuladas, marcadas como tales

#### Scenario: Todas
- **WHEN** se filtra por "Todas"
- **THEN** aparecen vigentes y anuladas, y las anuladas se distinguen visualmente

#### Scenario: Búsqueda sin tildes
- **WHEN** se busca "perez" y existe una donación del donante "Ana Pérez"
- **THEN** aparece esa donación

#### Scenario: Texto literal
- **WHEN** se busca un texto con `%`, `_` o comillas
- **THEN** se trata como texto y no devuelve todo ni produce error

### Requirement: Detalle de una donación
La página de una donación SHALL mostrar todos sus datos y, según su estado, ofrecer editar, asignar y anular, y MUST mostrarla como solo lectura si está anulada o su proyecto está finalizado.

#### Scenario: Donación vigente
- **WHEN** se abre una donación no anulada de un proyecto activo
- **THEN** se ven sus datos, el formulario de edición y el de anulación

#### Scenario: Sin asignar
- **WHEN** se abre una donación sin proyecto
- **THEN** se ofrece además la asignación a un proyecto

#### Scenario: Anulada
- **WHEN** se abre una donación anulada
- **THEN** se ve como anulada, sin formularios

#### Scenario: Proyecto finalizado
- **WHEN** se abre una donación de un proyecto finalizado
- **THEN** se ve su estado de solo lectura con la razón, sin formularios

#### Scenario: Inexistente
- **WHEN** se abre una donación que no existe o con un id no numérico
- **THEN** se muestra una página de no encontrado

### Requirement: Donación mixta visible
El detalle SHALL indicar si la donación forma parte de una donación mixta y enlazar a la otra parte.

#### Scenario: Con pareja
- **WHEN** se abre una donación vinculada a otra
- **THEN** se muestra un enlace a la otra parte

### Requirement: Lecturas por el acceso privado y sin contacto
La lista y el detalle SHALL pasar por el acceso privado, comprobar al responsable activo y MUST NOT mostrar el contacto del donante.

#### Scenario: Responsable desactivado
- **WHEN** un responsable desactivado con sesión vigente pide la lista o una donación
- **THEN** no recibe datos y es llevado al login

#### Scenario: Sin contacto
- **WHEN** se revisa lo que devuelven las lecturas
- **THEN** no incluyen el contacto de ningún apoyante
