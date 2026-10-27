# Spec Delta

## Purpose

Asegura que la ONG pueda recuperar sus datos si alguien borra o corrompe la base, y que sepa qué decisiones propias debe tomar antes de abrir el sitio al público.

## ADDED Requirements

### Requirement: Procedimiento de restauración escrito
El repositorio SHALL incluir un documento de respaldo y restauración (`RESPALDO.md`) con los pasos para recuperar la base de producción a un punto anterior, con la ventana de recuperación real del plan de Neon, qué se pierde al restaurar y quién decide restaurar.

#### Scenario: Pasos completos
- **WHEN** un responsable abre el documento
- **THEN** encuentra los pasos para crear una rama en un momento anterior, comprobar sus datos y dejar la aplicación apuntando a ella

#### Scenario: Ventana real
- **WHEN** el documento indica hasta cuándo se puede recuperar
- **THEN** el valor proviene de la comprobación en la cuenta real de Neon, no de una suposición

#### Scenario: Sin secretos
- **WHEN** se revisa el documento
- **THEN** no contiene cadenas de conexión, contraseñas ni nombres de proyecto privados

### Requirement: Restauración ensayada
El procedimiento SHALL haberse ensayado una vez sobre una rama de Neon, con la comprobación de que los datos esperados volvieron, y el resultado SHALL quedar anotado con su fecha.

#### Scenario: Ensayo documentado
- **WHEN** se lee el documento
- **THEN** indica cuándo se ensayó, qué se comprobó y cuánto tardó

#### Scenario: El ensayo no toca producción
- **WHEN** se ensaya la restauración
- **THEN** se hace en una rama aparte y la base de producción no se modifica

### Requirement: Lista de verificación previa a la publicación
El repositorio SHALL incluir una lista de verificación (`CHECKLIST-PUBLICACION.md`) con lo que decide la ONG y el código no puede resolver: texto legal definitivo del consentimiento y canal de contacto para pedir cambios o baja de datos, términos vigentes de Vercel Hobby para una web que pide donaciones, y los pasos pendientes de migración y despliegue en orden.

#### Scenario: Cada decisión tiene dueño y estado
- **WHEN** se abre la lista
- **THEN** cada punto indica quién lo decide, qué cambia en el sistema al resolverlo y si está pendiente

#### Scenario: Orden de publicación
- **WHEN** se sigue la lista
- **THEN** aparece primero crear el rol público y aplicar las migraciones, y después el despliegue, para que la aplicación no se publique sin las tablas ni las conexiones que necesita

#### Scenario: Sin datos reales de cuentas
- **WHEN** se revisa la lista
- **THEN** no contiene cuentas bancarias, contraseñas ni cadenas de conexión
