# app-deployment Specification

## Purpose

Define que la aplicación de La FAZ compila, se despliega en Vercel Hobby desde el repositorio y toma su configuración de variables de entorno, sin secretos en el código.

## Requirements

### Requirement: La aplicación compila para producción
El sistema SHALL compilar con `npm run build` sin errores de tipos ni de compilación y SHALL poder servirse con `npm run start`.

#### Scenario: Build limpio
- **WHEN** se ejecuta `npm install` y luego `npm run build` en un clon limpio del repositorio, con las variables de entorno requeridas
- **THEN** el build termina con código de salida 0

#### Scenario: Servir el build
- **WHEN** se ejecuta `npm run start` tras un build correcto
- **THEN** la página inicial responde con estado 200

### Requirement: Despliegue en Vercel Hobby desde el repositorio
El sistema SHALL poder desplegarse en Vercel Hobby a partir del repositorio de GitHub, sin pasos manuales fuera de la configuración de variables de entorno.

#### Scenario: Despliegue correcto
- **WHEN** se enlaza el repositorio a un proyecto de Vercel Hobby y se configuran las variables de entorno
- **THEN** el despliegue termina correctamente y la URL pública responde con la página inicial

### Requirement: Configuración por variables de entorno
El sistema SHALL leer la cadena de conexión a la base de datos únicamente desde variables de entorno y SHALL incluir una plantilla `.env.example` sin valores reales.

#### Scenario: Archivos de entorno fuera del control de versiones
- **WHEN** se revisa el repositorio
- **THEN** `.env.local` y cualquier otro `.env*` con valores reales están excluidos por `.gitignore` y solo `.env.example` está versionado

#### Scenario: Sin secretos en el código
- **WHEN** se buscan cadenas de conexión, contraseñas o claves en los archivos versionados
- **THEN** no aparece ningún valor real

### Requirement: Sin integraciones de pago ni de banco
El sistema SHALL NOT incluir SDK, webhooks ni credenciales de bancos o pasarelas de pago entre sus dependencias ni en su código.

#### Scenario: Dependencias sin pagos
- **WHEN** se revisa `package.json` y el código versionado
- **THEN** no hay dependencias ni configuración de pagos o bancos

### Requirement: Comandos del proyecto documentados
El sistema SHALL tener en `CLAUDE.md` los comandos reales de instalación, desarrollo, build y arranque, sin marcas `REVISAR` pendientes sobre ellos.

#### Scenario: Comandos coinciden con los scripts
- **WHEN** se comparan los comandos de `CLAUDE.md` con los scripts de `package.json`
- **THEN** coinciden y cada uno se ejecuta como está documentado
