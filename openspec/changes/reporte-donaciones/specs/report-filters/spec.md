# Spec Delta

## Purpose

Permite acotar el reporte por fechas de forma segura, lo mantiene dentro de la zona privada y garantiza que se consulta en pantalla y no se exporta.

## ADDED Requirements

### Requirement: Rango de fechas opcional
El reporte SHALL poder acotarse con un rango opcional "desde" y "hasta" sobre la fecha de recepción de la donación, inclusivo en ambos extremos, y sin rango SHALL mostrar todas las donaciones.

#### Scenario: Rango de un mes
- **WHEN** se pide del 2026-11-01 al 2026-11-30
- **THEN** solo cuentan las donaciones con fecha en esos días, incluidos ambos extremos

#### Scenario: Solo desde
- **WHEN** se indica solo "desde"
- **THEN** cuentan las donaciones con esa fecha o posterior

#### Scenario: Solo hasta
- **WHEN** se indica solo "hasta"
- **THEN** cuentan las donaciones con esa fecha o anterior

#### Scenario: Sin rango
- **WHEN** no se indica ninguna fecha
- **THEN** cuentan todas las donaciones

#### Scenario: El rango también acota las anuladas
- **WHEN** hay un rango
- **THEN** el conteo de anuladas de cada grupo cuenta solo las del rango

### Requirement: Validación del rango
El sistema SHALL validar las fechas del rango y MUST NOT consultar ni mostrar el reporte si son inválidas.

#### Scenario: Fecha que no existe o mal formada
- **WHEN** una fecha es "2026-02-30" o "03/11/2026"
- **THEN** se muestra un mensaje de fecha inválida y no se muestra el reporte

#### Scenario: Desde posterior a hasta
- **WHEN** "desde" es posterior a "hasta"
- **THEN** se muestra un mensaje de que el rango es inválido y no se muestra el reporte

#### Scenario: Fechas absurdas
- **WHEN** "desde" es anterior a 2020-01-01 o "hasta" es más de un año posterior a hoy en America/Lima
- **THEN** se muestra un mensaje de fecha fuera de rango y no se muestra el reporte

#### Scenario: Valores repetidos o ajenos
- **WHEN** la URL trae parámetros repetidos o desconocidos
- **THEN** se usa el primer valor de cada parámetro conocido y se ignora el resto

### Requirement: Rango leído de la URL por GET
El rango SHALL viajar en la URL, de modo que una vista del reporte se pueda enlazar o recargar, y el formulario de fechas MUST funcionar sin JavaScript.

#### Scenario: Recarga
- **WHEN** se recarga una página del reporte con rango
- **THEN** muestra el mismo reporte y conserva las fechas en el formulario

#### Scenario: Limpiar
- **WHEN** se usa la acción de quitar el rango
- **THEN** se muestra el reporte completo

### Requirement: Acceso solo para responsables activos
El reporte SHALL leerse por el acceso privado y comprobar al responsable activo antes de cualquier consulta.

#### Scenario: Responsable desactivado
- **WHEN** un responsable desactivado con sesión vigente pide el reporte
- **THEN** no recibe datos y es llevado al login

#### Scenario: Sin sesión
- **WHEN** alguien sin sesión pide `/reportes`
- **THEN** es redirigido al login

### Requirement: Sin exportación
El sistema MUST NOT ofrecer ni ejecutar la exportación del reporte a Excel, PDF, CSV u otro archivo.

#### Scenario: Interfaz
- **WHEN** se revisa la página del reporte
- **THEN** no tiene botones ni enlaces de descarga ni exportación

#### Scenario: Código y dependencias
- **WHEN** se revisan las dependencias y los archivos del reporte
- **THEN** no hay librerías de Excel, PDF o CSV, ni rutas que devuelvan archivos descargables

### Requirement: Enlace desde el panel
El panel SHALL ofrecer un enlace al reporte.

#### Scenario: Navegación
- **WHEN** un responsable abre el panel
- **THEN** ve un enlace "Reportes" que lleva a `/reportes`
