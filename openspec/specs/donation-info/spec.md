# donation-info Specification

## Purpose

Explica a los visitantes cómo donar con Yape, Plin y transferencia, nacional e internacional, dejando claro que los datos son una demostración y sin permitir ningún cobro desde el sitio.

## Requirements

### Requirement: Medios de donación presentados
La página "Cómo donar" SHALL explicar cómo donar por Yape, Plin, transferencia bancaria nacional y transferencia internacional, y la donación de productos, con una descripción breve y pasos sencillos para cada medio.

#### Scenario: Cuatro medios de dinero
- **WHEN** se abre "Cómo donar"
- **THEN** hay una sección por cada medio: Yape, Plin, transferencia nacional y transferencia internacional

#### Scenario: Productos
- **WHEN** se revisa la página
- **THEN** indica que también se aceptan donaciones en productos y que se coordinan con la ONG, sin prometer listas, fechas ni lugares que la ONG no haya entregado

### Requirement: Aviso de simulación visible
La página SHALL mostrar de forma destacada, antes de cualquier dato de cuenta, un aviso de que los datos son de demostración, de que el sitio todavía no es un canal real de donación y de que no se debe enviar dinero a esos datos. Cada bloque de medio MUST estar marcado también como demostración.

#### Scenario: Aviso arriba
- **WHEN** se abre "Cómo donar"
- **THEN** el aviso aparece antes del primer medio y no puede pasarse por alto (no depende del color solamente, tiene texto)

#### Scenario: Cada medio marcado
- **WHEN** se lee cualquier bloque de medio
- **THEN** indica que sus datos son de demostración

#### Scenario: Mención en el acceso del inicio
- **WHEN** el inicio ofrece el acceso a "Cómo donar"
- **THEN** no presenta la donación como disponible para cobro real

### Requirement: Datos de cuenta ficticios
Los datos de cuenta mostrados (número de Yape y Plin, banco, número de cuenta, CCI, código SWIFT, titular) SHALL ser valores ficticios evidentes y MUST NOT corresponder a ninguna cuenta real. El repositorio MUST NOT contener datos de cuentas reales.

#### Scenario: Valores evidentes
- **WHEN** se revisan los datos de cuenta
- **THEN** son valores de relleno claramente falsos (por ejemplo, ceros y "Banco de Demostración")

#### Scenario: Prueba automática
- **WHEN** se ejecutan las pruebas
- **THEN** una prueba falla si un dato de cuenta deja de ser un valor de relleno reconocible

### Requirement: Sin función de cobro
La página MUST NOT ofrecer botones de pago, formularios, enlaces a pasarelas ni campos para escribir datos de tarjeta, cuenta o contacto, y el proyecto MUST NOT incluir SDK, webhooks ni credenciales de bancos o pasarelas.

#### Scenario: Interfaz
- **WHEN** se revisa la página
- **THEN** no hay `form`, `input`, `button` de envío ni enlaces a servicios de pago

#### Scenario: Dependencias
- **WHEN** se revisan `package.json` y el código
- **THEN** no hay librerías de pago ni claves o credenciales de bancos

### Requirement: Sin recibos ni promesas de beneficio tributario
La página MUST NOT ofrecer recibos de donación con validez tributaria ni prometer beneficios tributarios (PRD: No alcance), aunque el pie de página identifique a la ONG como perceptora de donaciones.

#### Scenario: Texto
- **WHEN** se lee "Cómo donar"
- **THEN** no menciona recibos ni deducciones tributarias
