# donation-registration Specification

## Purpose

Permite que un responsable registre lo que La FAZ ha recibido, en dinero o en producto, asignado a un proyecto o sin asignar, con reglas que impiden registros incoherentes y con cada registro en el historial. El sistema solo registra lo que el responsable declara haber recibido; no cobra ni mueve dinero.

## Requirements

### Requirement: Registrar una donación en dinero
Un responsable activo SHALL poder registrar una donación en dinero con donante, monto en soles mayor que cero, medio (yape, plin o transferencia), fecha y proyecto, y la donación SHALL quedar atribuida a ese responsable.

#### Scenario: Dinero asignado a un proyecto
- **WHEN** un responsable registra S/ 150,50 por Yape de un donante para un proyecto activo
- **THEN** existe una donación `dinero` con monto 150.50, medio `yape`, ese proyecto y ese donante, registrada por el responsable, y una fila de historial de creación

#### Scenario: Medio obligatorio
- **WHEN** se intenta registrar dinero sin medio
- **THEN** no se guarda, no queda historial y se muestra el error del campo

#### Scenario: Monto inválido
- **WHEN** el monto es cero, negativo, tiene más de dos decimales, no es numérico o supera 9.999.999.999,99
- **THEN** no se guarda y se muestra el error del campo; el monto acepta punto o coma decimal

#### Scenario: Dinero a un proyecto sin meta
- **WHEN** se registra dinero para un proyecto activo informativo (sin meta)
- **THEN** se guarda, porque el dinero suma a un total en soles por proyecto y no a una barra de unidades

### Requirement: Registrar una donación en producto asignada a un ítem
Un responsable activo SHALL poder registrar una donación en producto indicando donante, proyecto, ítem de ese proyecto, cantidad entera mayor que cero y fecha, sin medio de pago.

#### Scenario: Producto asignado
- **WHEN** un responsable registra 500 packs del ítem "Pack de útiles" de "10 Derechos"
- **THEN** existe una donación `producto` con ese proyecto, ese ítem y cantidad 500, sin monto ni medio, y una fila de historial

#### Scenario: Ítem de otro proyecto
- **WHEN** se registra un producto con un ítem que no pertenece al proyecto elegido
- **THEN** no se guarda y se muestra que el ítem no pertenece al proyecto

#### Scenario: Proyecto sin meta o sin ítems
- **WHEN** se registra un producto asignado a un proyecto sin meta
- **THEN** no se guarda y se muestra que ese proyecto no tiene meta; para recibir el producto el responsable puede registrarlo "Sin asignar" o crear antes el ítem

#### Scenario: Cantidad inválida
- **WHEN** la cantidad es cero, negativa, decimal o supera 1.000.000
- **THEN** no se guarda y se muestra el error del campo

### Requirement: Donación sin proyecto ("Sin asignar")
El sistema SHALL permitir registrar una donación sin proyecto, que no cuenta en ninguna barra hasta que se asigne, y un producto sin asignar SHALL llevar una descripción de lo recibido y no un ítem.

#### Scenario: Dinero sin asignar
- **WHEN** se registra dinero eligiendo "Sin asignar"
- **THEN** la donación se guarda sin proyecto

#### Scenario: Producto sin asignar
- **WHEN** se registra un producto "Sin asignar" con la descripción "Cajas de cereal" y cantidad 20
- **THEN** se guarda sin proyecto, sin ítem y con esa descripción

#### Scenario: Descripción obligatoria
- **WHEN** se registra un producto sin asignar sin descripción o con más de 200 caracteres
- **THEN** no se guarda y se muestra el error del campo

#### Scenario: Proyecto sin elegir
- **WHEN** el responsable no elige ningún proyecto ni "Sin asignar"
- **THEN** no se guarda y se muestra "Elige un proyecto o Sin asignar"

### Requirement: Un proyecto finalizado no recibe donaciones
El sistema MUST NOT registrar donaciones en un proyecto finalizado, ni ofrecerlo como opción, y SHALL comprobar el estado del proyecto con la fila bloqueada para que un cierre simultáneo no se cruce con el registro.

#### Scenario: Opciones del formulario
- **WHEN** se abre el formulario de registro
- **THEN** la lista de proyectos incluye solo proyectos activos

#### Scenario: Proyecto finalizado en la acción
- **WHEN** se envía una donación para un proyecto finalizado
- **THEN** no se guarda y se muestra que el proyecto ya está finalizado

#### Scenario: Cierre simultáneo
- **WHEN** un proyecto se finaliza mientras otra persona registra una donación para él
- **THEN** si el cierre se confirma primero, el registro se rechaza por proyecto finalizado

### Requirement: El donante debe tener el rol de donante
El sistema SHALL aceptar como donante solo a un apoyante existente con el rol de donante, y SHALL comprobarlo con la fila del apoyante bloqueada para que una edición de roles simultánea no se cruce con el registro.

#### Scenario: Apoyante sin rol de donante
- **WHEN** se envía una donación de un apoyante que solo es voluntario
- **THEN** no se guarda y se muestra que esa persona no es donante

#### Scenario: Apoyante inexistente
- **WHEN** se envía una donación con un donante que no existe
- **THEN** no se guarda y se muestra que no se encontró al donante

#### Scenario: Lista de donantes
- **WHEN** se abre el formulario
- **THEN** la lista contiene apoyantes con rol de donante, ordenada por nombre y filtrable escribiendo, y no incluye datos de contacto

#### Scenario: Edición de roles simultánea
- **WHEN** a un apoyante se le quita el rol de donante mientras otra persona registra una donación suya
- **THEN** si la edición se confirma primero, el registro se rechaza por falta del rol

### Requirement: Fecha de la donación
La fecha SHALL ser la fecha en que se recibió, con valor por defecto igual a hoy en la zona America/Lima, y MUST NOT ser posterior a hoy en esa zona.

#### Scenario: Fecha por defecto
- **WHEN** se abre el formulario a las 21:00 en Lima, cuando en UTC ya es el día siguiente
- **THEN** la fecha por defecto es el día de Lima

#### Scenario: Fecha futura
- **WHEN** la fecha es posterior a hoy en Lima
- **THEN** no se guarda y se muestra que la fecha no puede ser futura

#### Scenario: Fecha pasada
- **WHEN** la fecha es anterior a hoy (por ejemplo, una donación recibida la semana pasada)
- **THEN** se guarda con esa fecha

### Requirement: Proyecto por defecto
El formulario SHALL preseleccionar el proyecto de la última donación asignada a un proyecto que registró ese responsable, siempre que ese proyecto siga activo, sin guardar estado fuera de la base.

#### Scenario: Responsable con donaciones previas
- **WHEN** un responsable abre el formulario y su última donación fue para un proyecto activo
- **THEN** ese proyecto aparece preseleccionado

#### Scenario: Sin donaciones previas o proyecto finalizado
- **WHEN** el responsable no tiene donaciones o su último proyecto ya está finalizado
- **THEN** ningún proyecto queda preseleccionado y debe elegir uno o "Sin asignar"

### Requirement: Historial de cada donación
Cada donación registrada SHALL dejar una fila de historial de creación con sus valores de negocio y el responsable que la registró, sin copiar datos personales del donante.

#### Scenario: Contenido del historial
- **WHEN** se registra una donación
- **THEN** el historial guarda su tipo, monto o cantidad, medio, proyecto, ítem, descripción, fecha y el identificador del donante, y no su nombre ni su contacto

#### Scenario: Atribución
- **WHEN** la entrada trae un identificador de responsable distinto del de la sesión
- **THEN** la donación y el historial se atribuyen al responsable de la sesión

### Requirement: Acceso solo para responsables activos
El formulario y la acción de registro SHALL pasar por el acceso privado y comprobar al responsable activo.

#### Scenario: Responsable desactivado
- **WHEN** un responsable desactivado con sesión vigente abre el formulario o envía una donación
- **THEN** no recibe datos, no se guarda nada y es llevado al login

#### Scenario: Sin sesión
- **WHEN** alguien sin sesión pide la página de registro
- **THEN** es redirigido al login

### Requirement: Formulario de una sola pantalla
El registro SHALL poder completarse en una sola pantalla, mostrando solo los campos que corresponden al tipo y al proyecto elegidos, para cumplir que un responsable registre una donación en menos de 2 minutos.

#### Scenario: Campos según el tipo
- **WHEN** el responsable elige dinero
- **THEN** ve monto y medio, y no ve ítem, cantidad ni descripción

#### Scenario: Producto en un proyecto
- **WHEN** el responsable elige producto y un proyecto con meta
- **THEN** ve la lista de ítems de ese proyecto y la cantidad

#### Scenario: Producto sin asignar
- **WHEN** el responsable elige producto y "Sin asignar"
- **THEN** ve la descripción y la cantidad, y no ve ítem

#### Scenario: Confirmación tras guardar
- **WHEN** se guarda una donación
- **THEN** la pantalla confirma lo registrado y ofrece registrar otra, registrar la otra parte de una donación mixta y volver al panel
