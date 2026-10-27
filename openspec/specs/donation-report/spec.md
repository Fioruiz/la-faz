# donation-report Specification

## Purpose

Permite ver cuánto registró cada responsable y cuánto entró por proyecto, en dinero y en productos, para conciliar cuentas y entender cada campaña, con cifras que coinciden con el avance de las metas.

## Requirements

### Requirement: Reporte por responsable
El reporte SHALL mostrar un grupo por cada responsable que registró donaciones, con su nombre y las donaciones que él registró, sin importar a qué proyecto fueron.

#### Scenario: Dos responsables
- **WHEN** un responsable registró 3 donaciones y otro 2, todas vigentes
- **THEN** el reporte muestra dos grupos, con 3 y 2 donaciones

#### Scenario: Responsable desactivado
- **WHEN** un responsable fue desactivado y sus donaciones siguen guardadas
- **THEN** su grupo sigue apareciendo con su nombre, marcado como desactivado, y con sus donaciones

#### Scenario: Atribución
- **WHEN** una donación se editó o anuló por otro responsable
- **THEN** sigue contada en el grupo de quien la registró

#### Scenario: Sin donaciones
- **WHEN** un responsable no tiene ninguna donación (vigente ni anulada) en el rango
- **THEN** su grupo no se muestra

### Requirement: Reporte por proyecto
El reporte SHALL mostrar un grupo por cada proyecto con donaciones y un grupo "Sin asignar" con las donaciones sin proyecto.

#### Scenario: Proyecto y sin asignar
- **WHEN** hay donaciones en "10 Derechos" y otras sin proyecto
- **THEN** el reporte muestra el grupo "10 Derechos" y el grupo "Sin asignar"

#### Scenario: Proyecto finalizado
- **WHEN** un proyecto finalizado tiene donaciones
- **THEN** aparece con su estado y sus cifras finales

#### Scenario: Reasignación
- **WHEN** una donación se reasigna de un proyecto a otro
- **THEN** el reporte cuenta la donación en el segundo y deja de contarla en el primero

### Requirement: Dinero con total y subtotales por medio
Cada grupo SHALL mostrar el total en soles de sus donaciones vigentes en dinero y los subtotales por Yape, Plin y transferencia, de modo que los subtotales siempre sumen el total.

#### Scenario: Subtotales
- **WHEN** un grupo recibió S/ 100 por Yape, S/ 50,50 por Plin y S/ 200 por transferencia
- **THEN** el total es S/ 350,50 y cada medio muestra su subtotal

#### Scenario: Medio ausente
- **WHEN** una donación en dinero vigente no tiene medio
- **THEN** su monto suma al total y aparece como "sin medio", para que los subtotales sumen el total

#### Scenario: Exactitud
- **WHEN** un grupo recibió S/ 0,10 y S/ 0,20
- **THEN** el total es exactamente S/ 0,30

#### Scenario: Sin dinero
- **WHEN** un grupo solo recibió productos
- **THEN** su total en soles es S/ 0,00

### Requirement: Productos por ítem sin mezclar unidades
Cada grupo SHALL mostrar los productos vigentes agrupados por ítem y unidad con su cantidad y su número de donaciones, y MUST NOT sumar cantidades de ítems o unidades distintas.

#### Scenario: Dos ítems
- **WHEN** un grupo recibió 1.200 packs y 100 botellas
- **THEN** se muestran dos renglones, uno por ítem, con su cantidad y su unidad

#### Scenario: Mismo nombre en otro proyecto
- **WHEN** dos proyectos tienen un ítem llamado "Pack"
- **THEN** el reporte por responsable los distingue por proyecto

#### Scenario: Productos sin asignar
- **WHEN** hay productos sin asignar con descripciones distintas
- **THEN** se muestran en un solo renglón "Productos sin asignar" con su cantidad de donaciones y sin sumar cantidades

### Requirement: Las anuladas quedan fuera de los totales
Los totales y las cantidades de cada grupo MUST excluir las donaciones anuladas, y cada grupo SHALL mostrar aparte cuántas tiene anuladas, con un enlace a la lista de donaciones anuladas.

#### Scenario: Anulada
- **WHEN** se anula una donación de S/ 100
- **THEN** el total del grupo baja S/ 100 y el conteo de anuladas sube en 1

#### Scenario: Solo anuladas
- **WHEN** un grupo solo tiene donaciones anuladas en el rango
- **THEN** se muestra con totales en cero y su conteo de anuladas

#### Scenario: Enlace
- **WHEN** se usa el enlace de anuladas
- **THEN** abre la lista de donaciones con el filtro de anuladas

### Requirement: Totales generales
El reporte SHALL mostrar los totales generales de todas las donaciones vigentes del rango, y el total general MUST coincidir con la suma de los grupos de cada vista.

#### Scenario: Coherencia entre vistas
- **WHEN** se compara el total en soles de todos los responsables con el de todos los proyectos incluido "Sin asignar"
- **THEN** son iguales al total general

#### Scenario: Reporte vacío
- **WHEN** no hay donaciones en el rango
- **THEN** se muestra un mensaje de que no hay donaciones y los totales en cero

### Requirement: Coherencia con el avance
Sin filtro de fechas, el total en soles de cada proyecto y la cantidad por ítem del reporte SHALL ser iguales a los del avance de los proyectos, porque ambos aplican la misma regla de donación vigente.

#### Scenario: Igualdad con el avance
- **WHEN** se comparan el reporte y el avance de un proyecto sin filtro de fechas
- **THEN** el total en soles y lo recibido por cada ítem son iguales

#### Scenario: Una sola regla
- **WHEN** se revisa el código
- **THEN** la regla de qué donaciones cuentan (dinero o producto, no anuladas) está definida en un solo lugar usado por el avance y por el reporte

### Requirement: Sin datos personales de donantes
El reporte MUST NOT incluir el nombre ni el contacto de ningún donante, solo agregados.

#### Scenario: Revisión del resultado
- **WHEN** se revisa lo que devuelve el reporte
- **THEN** no aparece ningún nombre ni contacto de apoyantes, y sí el nombre de los responsables

### Requirement: Agregación en la base
Las sumas SHALL hacerse con agregaciones SQL, con un número fijo de consultas independiente de la cantidad de donaciones, y el dinero en céntimos enteros.

#### Scenario: Muchas donaciones
- **WHEN** hay 500 donaciones
- **THEN** el reporte se arma con el mismo número de consultas que con 5
