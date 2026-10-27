# Spec Delta

## Purpose

Garantiza que lo público se lee por un solo módulo que no expone datos personales ni dinero, que coincide exactamente con el avance privado y que, si la base falla, avisa en lugar de mostrar un avance falso.

## ADDED Requirements

### Requirement: Un solo módulo de lecturas públicas
Las páginas públicas que muestran datos de la base SHALL leer únicamente por el módulo de lecturas públicas, y MUST NOT consultar tablas, el esquema ni el acceso privado directamente.

#### Scenario: Revisión del código
- **WHEN** se revisan los archivos públicos
- **THEN** ninguno importa la base, el esquema, Drizzle, Auth.js ni las lecturas privadas; solo el módulo público

#### Scenario: Sin sesión
- **WHEN** un visitante sin sesión abre la lista o el detalle
- **THEN** los ve completos, sin redirección al login

### Requirement: Salida pública sin datos personales
Lo que devuelve el módulo público MUST NOT incluir nombres ni contactos de apoyantes (donantes o voluntarios, anónimos o no), ni identificadores de donaciones o de responsables, y toda aparición futura de un nombre de apoyante SHALL pasar por la función de nombre público.

#### Scenario: Revisión del resultado
- **WHEN** hay donaciones de un donante con nombre y contacto conocidos
- **THEN** ni el resultado del módulo ni el HTML de las páginas contienen ese nombre ni ese contacto

#### Scenario: Único punto de nombres
- **WHEN** se revisa el módulo público
- **THEN** no lee la tabla de apoyantes

### Requirement: Salida pública sin dinero ni sin asignar
Lo que devuelve el módulo público MUST NOT incluir montos en dinero, totales en soles, lo que falta en soles, costos referenciales ni donaciones "Sin asignar", y las donaciones anuladas MUST NOT contar.

#### Scenario: Dinero
- **WHEN** un proyecto recibió dinero
- **THEN** ninguna barra cambia y ningún monto aparece en la salida ni en las páginas

#### Scenario: Costo referencial
- **WHEN** un ítem tiene costo referencial
- **THEN** el costo no aparece en la salida pública

#### Scenario: Sin asignar y anuladas
- **WHEN** hay productos "Sin asignar" y donaciones anuladas
- **THEN** no cuentan en ningún proyecto ni ítem

### Requirement: Coincidencia exacta con el avance privado
La meta y lo recibido por ítem en lo público SHALL ser iguales a los de la función de avance que usa la zona privada, aplicando el tope de la meta solo al presentar.

#### Scenario: Igualdad
- **WHEN** se compara cada ítem del módulo público con el avance privado de la misma base
- **THEN** la meta es igual y lo recibido público es igual a `min(recibido privado, meta)`

#### Scenario: Cambio tras una corrección
- **WHEN** una donación se edita, reasigna o anula en la zona privada
- **THEN** la siguiente visita pública refleja el cambio, sin caché

### Requirement: Sin caché
Las páginas públicas con datos MUST renderizarse en cada visita y MUST NOT usar caché ni revalidación.

#### Scenario: Revisión
- **WHEN** se revisan las páginas de proyectos
- **THEN** son dinámicas y no usan caché de datos

### Requirement: Fallo de la base
Si la base de datos no responde, la zona pública SHALL mostrar una página de error que lo explique y MUST NOT mostrar un avance en cero ni cifras viejas.

#### Scenario: Base caída
- **WHEN** la consulta falla
- **THEN** se muestra la página de error con la opción de reintentar y ninguna barra ni cantidad

#### Scenario: Sin filtración del error
- **WHEN** la consulta falla
- **THEN** la página no muestra el mensaje técnico, cadenas de conexión ni datos del servidor

### Requirement: Agregación en la base con consultas fijas
El avance público SHALL calcularse con agregaciones SQL, con un número fijo de consultas independiente de la cantidad de donaciones.

#### Scenario: Muchas donaciones
- **WHEN** hay 500 donaciones
- **THEN** la lista y el detalle se arman con el mismo número de consultas que con 5

### Requirement: Sin escrituras
El módulo público y sus páginas MUST NOT escribir en la base.

#### Scenario: Revisión
- **WHEN** se revisa el módulo público
- **THEN** solo contiene lecturas
