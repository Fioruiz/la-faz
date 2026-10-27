# Spec Delta

## Purpose

Define cómo se calcula lo recibido y lo que falta para cada meta y cada proyecto, en un solo lugar compartido por la zona privada y, más adelante, la pública, para que la barra pública coincida exactamente con lo registrado.

## ADDED Requirements

### Requirement: Una sola función de avance
El avance SHALL calcularse con una única función compartida, sin dependencias de Next ni de la zona privada o pública, y ninguna pantalla MUST calcular por su cuenta lo recibido, el excedente o la falta.

#### Scenario: Mismo resultado en las dos zonas
- **WHEN** la zona privada y la zona pública piden el avance de un mismo ítem
- **THEN** reciben la misma cantidad recibida y la misma meta, y solo la presentación pública limita la barra al 100%

#### Scenario: Sin contadores guardados
- **WHEN** se revisa el esquema y el código
- **THEN** no existe ninguna columna ni caché con la cantidad recibida: se calcula en cada lectura

### Requirement: Recibido de un ítem
Lo recibido de un ítem SHALL ser la suma de la cantidad de las donaciones en producto, no anuladas, con ese ítem, y MUST NOT incluir dinero, donaciones sin asignar ni donaciones de otros ítems.

#### Scenario: Suma de varias donaciones
- **WHEN** un ítem recibió 500, 300 y 400 unidades en tres donaciones vigentes
- **THEN** lo recibido es 1200

#### Scenario: Anuladas no suman
- **WHEN** una de esas donaciones se anula
- **THEN** lo recibido baja de inmediato en la siguiente lectura

#### Scenario: Dinero no suma
- **WHEN** el proyecto recibe dinero
- **THEN** ningún ítem cambia su cantidad recibida

#### Scenario: Sin asignar no suma
- **WHEN** existe un producto sin asignar con 50 unidades
- **THEN** no suma a ningún ítem

#### Scenario: Ítem sin donaciones
- **WHEN** un ítem no recibió nada
- **THEN** lo recibido es 0

### Requirement: Porcentaje y excedente reales
Para cada ítem el cálculo SHALL devolver el porcentaje real (entero hacia abajo, sin tope), el excedente (`max(0, recibido − meta)`), lo que falta (`max(0, meta − recibido)`) y si la meta está cumplida (`recibido >= meta`).

#### Scenario: Excedente
- **WHEN** un ítem con meta 2000 recibió 2150
- **THEN** el excedente es 150, no falta nada, la meta está cumplida y el porcentaje real es 107

#### Scenario: Casi cumplida
- **WHEN** un ítem con meta 2000 recibió 1999
- **THEN** el porcentaje real es 99 y la meta no está cumplida

#### Scenario: Avance parcial
- **WHEN** un ítem con meta 2000 recibió 1200
- **THEN** el porcentaje real es 60 y faltan 800

### Requirement: Total en soles por proyecto
El total en soles de un proyecto SHALL ser la suma del monto de las donaciones en dinero, no anuladas, asignadas a ese proyecto, calculada sin errores de redondeo.

#### Scenario: Suma exacta
- **WHEN** un proyecto recibió S/ 0,10 y S/ 0,20
- **THEN** el total es S/ 0,30

#### Scenario: Reasignación
- **WHEN** una donación en dinero se reasigna de un proyecto a otro
- **THEN** el total del primero baja y el del segundo sube en esa misma cantidad

#### Scenario: Proyecto informativo
- **WHEN** un proyecto sin meta recibe dinero
- **THEN** tiene total en soles, no tiene ítems ni metas y no tiene "falta en soles"

### Requirement: Falta en soles del proyecto
La falta en soles SHALL ser `max(0, Σ sobre los ítems con costo de (max(0, meta − recibido) × costo_referencial) − total_dinero_del_proyecto)`, de modo que el excedente de un ítem no compense lo que falta de otro.

#### Scenario: Caso base
- **WHEN** un proyecto tiene un ítem con meta 2000, costo S/ 13 y recibió 1200 packs, y recibió S/ 5.000 en dinero
- **THEN** lo que falta en producto cuesta S/ 10.400 y la falta en soles es S/ 5.400

#### Scenario: Dinero mayor que el costo restante
- **WHEN** el dinero recibido supera el costo de lo que falta
- **THEN** la falta en soles es S/ 0, no un número negativo

#### Scenario: Excedente de un ítem no compensa a otro
- **WHEN** un ítem tiene excedente de 150 unidades y otro ítem con costo todavía falta
- **THEN** la falta del segundo ítem no se reduce por el excedente del primero

#### Scenario: Metas cumplidas
- **WHEN** todos los ítems con costo cumplieron su meta
- **THEN** la falta en soles es S/ 0

### Requirement: Grado de estimación de la falta
El resultado SHALL indicar si la falta en soles es completa, parcial o no disponible: parcial cuando el proyecto tiene algún ítem sin costo referencial, y no disponible cuando ningún ítem tiene costo.

#### Scenario: Completa
- **WHEN** todos los ítems del proyecto tienen costo
- **THEN** la falta se marca como completa

#### Scenario: Parcial
- **WHEN** el proyecto tiene un ítem con costo y otro sin costo
- **THEN** la falta cuenta solo el ítem con costo y se marca como estimado parcial

#### Scenario: No disponible
- **WHEN** ningún ítem del proyecto tiene costo, o el proyecto no tiene ítems
- **THEN** no se calcula la falta en soles y se marca como no disponible, en vez de mostrar cero

### Requirement: Resumen de metas del proyecto sin mezclar unidades
El resumen de un proyecto SHALL indicar cuántas metas están cumplidas de cuántas hay, y MUST NOT combinar ítems de unidades distintas en un porcentaje único del proyecto.

#### Scenario: Una de dos
- **WHEN** un proyecto tiene dos ítems y solo uno cumplió su meta
- **THEN** el resumen dice 1 de 2 metas cumplidas

#### Scenario: Sin porcentaje del proyecto
- **WHEN** se revisa lo que devuelve el cálculo
- **THEN** no existe un porcentaje único del proyecto

### Requirement: Resumen de lo sin asignar
El cálculo SHALL ofrecer el total en soles y la cantidad de donaciones pendientes de asignar: las no anuladas sin proyecto.

#### Scenario: Pendientes
- **WHEN** hay S/ 200 en dinero y un producto sin asignar, y una donación sin asignar anulada
- **THEN** el total en soles es S/ 200 y la cantidad de donaciones pendientes es 2

#### Scenario: Al asignar
- **WHEN** una donación sin asignar se asigna a un proyecto
- **THEN** sale del resumen de lo sin asignar y entra al avance del proyecto

### Requirement: Agregación en la base
Las sumas SHALL calcularse con agregaciones en SQL y MUST NOT cargar todas las donaciones en memoria, con un número fijo de consultas independiente de la cantidad de donaciones.

#### Scenario: Muchas donaciones
- **WHEN** hay 500 donaciones en un proyecto
- **THEN** el avance se calcula con el mismo número de consultas que con 5

### Requirement: Montos exactos
Los cálculos con dinero SHALL hacerse en céntimos enteros, nunca con números de coma flotante.

#### Scenario: Sin coma flotante
- **WHEN** se revisa el módulo de cálculo
- **THEN** no usa conversiones a coma flotante para los montos

#### Scenario: Cantidad por costo
- **WHEN** faltan 3 unidades con costo S/ 13,33
- **THEN** el costo es exactamente S/ 39,99
