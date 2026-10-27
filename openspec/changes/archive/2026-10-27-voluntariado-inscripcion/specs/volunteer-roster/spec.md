# Spec Delta

## Purpose

Permite a los responsables ver quién se inscribió como voluntario, cuándo y con qué mensaje, y llegar al contacto de cada persona, sin exponer el contacto en la lista ni abrir esos datos a la zona pública.

## ADDED Requirements

### Requirement: Lista de voluntarios inscritos
La zona privada SHALL tener una página de voluntarios inscritos (`/voluntarios`) que liste las inscripciones de la más reciente a la más antigua, cada una con el nombre de la persona, la fecha de inscripción y su mensaje si lo dejó, y SHALL estar accesible desde el panel.

#### Scenario: Orden
- **WHEN** hay inscripciones de distintos días
- **THEN** la lista muestra primero la más reciente

#### Scenario: Datos de cada fila
- **WHEN** una persona se inscribió con mensaje
- **THEN** su fila muestra nombre, fecha y mensaje

#### Scenario: Sin mensaje
- **WHEN** una inscripción no tiene mensaje
- **THEN** la fila muestra nombre y fecha sin texto de relleno

#### Scenario: Sin inscripciones
- **WHEN** todavía no hay inscripciones
- **THEN** la página muestra un mensaje de que aún no hay voluntarios inscritos

#### Scenario: Acceso desde el panel
- **WHEN** un responsable abre el panel
- **THEN** ve un enlace a los voluntarios inscritos

### Requirement: Contacto fuera de la lista
La lista SHALL NOT mostrar el contacto de las personas. Cada fila SHALL enlazar al detalle del apoyante, donde el contacto ya se consulta, para que el responsable llegue a él con un paso más.

#### Scenario: Lista sin contacto
- **WHEN** un responsable abre la lista de voluntarios
- **THEN** ningún contacto aparece en la página

#### Scenario: Camino al contacto
- **WHEN** el responsable abre una fila
- **THEN** llega al detalle del apoyante, donde ve su contacto

### Requirement: Mensaje como texto
El mensaje escrito por el visitante SHALL mostrarse siempre como texto, nunca interpretado como marcado, enlaces ni código.

#### Scenario: Mensaje con etiquetas
- **WHEN** una inscripción trae un mensaje con etiquetas HTML o un script
- **THEN** la lista las muestra como texto literal y no se ejecuta nada

### Requirement: Solo responsables activos
La lectura de voluntarios inscritos SHALL pasar por la comprobación de responsable activo en cada petición, como el resto de la zona privada.

#### Scenario: Sin sesión
- **WHEN** alguien sin sesión abre `/voluntarios`
- **THEN** es llevado al login

#### Scenario: Responsable desactivado
- **WHEN** un responsable desactivado con sesión vigente abre `/voluntarios`
- **THEN** es rechazado y llevado al login

### Requirement: Lista acotada
La lista SHALL mostrar como máximo las 200 inscripciones más recientes e indicar cuántas hay en total cuando existan más.

#### Scenario: Más de 200
- **WHEN** hay 250 inscripciones
- **THEN** se muestran las 200 más recientes y un aviso de que hay 250 en total
