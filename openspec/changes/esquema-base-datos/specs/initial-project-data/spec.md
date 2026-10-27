# Spec Delta

## Purpose

Garantiza que, tras preparar la base, existan los cuatro proyectos de La FAZ con su indicador de meta correcto, sin duplicarse al repetir la carga.

## ADDED Requirements

### Requirement: Los cuatro proyectos iniciales
Tras cargar los datos iniciales, la base SHALL contener los proyectos "10 Derechos", "Apoyo alimentario", "Música" y "Casa del Buen Samaritano", todos con estado `activo`, y solo los dos primeros con `tiene_meta` verdadero.

#### Scenario: Carga sobre base migrada y vacía
- **WHEN** se ejecuta la carga de datos iniciales sobre una base recién migrada
- **THEN** existen exactamente cuatro proyectos con esos nombres, estado `activo`, y `tiene_meta` verdadero solo en "10 Derechos" y "Apoyo alimentario"

### Requirement: Carga repetible
La carga de datos iniciales MUST NOT duplicar proyectos ni sobrescribir cambios hechos después sobre ellos.

#### Scenario: Segunda ejecución
- **WHEN** se ejecuta la carga dos veces seguidas
- **THEN** sigue habiendo exactamente cuatro proyectos

#### Scenario: Proyecto ya editado
- **WHEN** un proyecto inicial fue finalizado o su descripción cambió y se vuelve a ejecutar la carga
- **THEN** ese proyecto conserva su estado y su descripción actuales

### Requirement: Sin datos personales ni cuentas en la carga
Los datos iniciales SHALL contener solo los cuatro proyectos; MUST NOT incluir responsables, contraseñas, donantes, voluntarios, ítems con meta ni datos de cuentas bancarias.

#### Scenario: Otras tablas vacías
- **WHEN** se ejecuta la carga sobre una base recién migrada
- **THEN** las tablas `responsables`, `apoyantes`, `items_meta`, `donaciones`, `voluntarios_inscritos` y `audit_log` siguen vacías
