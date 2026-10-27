import { sql } from "drizzle-orm";

// Rol de Postgres de SOLO LECTURA de la zona pública (ADR 0011). Sin Next: lo usan el script que lo crea y las
// pruebas, para que ambos hablen del mismo conjunto de permisos. Lo que no está aquí queda DENEGADO: una tabla nueva
// o una columna nueva en `donaciones` no se lee desde lo público hasta que se añada a propósito. OJO: `proyectos` e
// `items_meta` se conceden COMPLETAS (incluido `items_meta.costo_referencial`, que la capa pública no muestra), así
// que una columna sensible añadida después a esas dos tablas SÍ sería legible: al añadirla, pasar esa tabla a
// permisos por columna.
// La contraseña nunca está en el repositorio: el script la lee de PUBLICO_LECTURA_PASSWORD.

export const ROL_PUBLICO = "publico_lectura";
export const LIMITE_CONEXIONES = 20;
export const TIEMPO_MAXIMO_CONSULTA = "5s";

// Tablas legibles completas: lo que muestra la zona pública (proyectos e ítems con su meta).
export const TABLAS_PUBLICAS = ["proyectos", "items_meta"] as const;

// De `donaciones` solo lo que usa consultarAvance(). NO incluye apoyante_id, medio, registrado_por,
// descripcion_producto, donacion_vinculada_id, fecha ni creado_en. `monto` sí: el avance suma el total en soles
// que la capa pública descarta (el tipo ProyectoPublico no tiene campos de dinero).
export const COLUMNAS_DONACIONES = ["id", "proyecto_id", "item_id", "tipo", "cantidad", "monto", "anulada"] as const;

// Tablas y columnas que el rol NO debe poder leer (lo usan las pruebas).
export const TABLAS_DENEGADAS = ["apoyantes", "voluntarios_inscritos", "responsables", "audit_log", "intentos_limitados"] as const;
export const COLUMNAS_DONACIONES_DENEGADAS = [
  "apoyante_id",
  "medio",
  "registrado_por",
  "descripcion_producto",
  "donacion_vinculada_id",
  "fecha",
  "creado_en",
] as const;

// Sentencias de permisos, en orden. Todas son idempotentes. El nombre del rol y de las tablas son constantes de
// este archivo (nunca entrada del usuario), así que se pueden interpolar.
export function sentenciasPermisos(): string[] {
  const columnas = COLUMNAS_DONACIONES.map((c) => `"${c}"`).join(", ");
  return [
    `revoke all on all tables in schema public from ${ROL_PUBLICO}`,
    `revoke all on all sequences in schema public from ${ROL_PUBLICO}`,
    `revoke create on schema public from ${ROL_PUBLICO}`,
    `grant usage on schema public to ${ROL_PUBLICO}`,
    ...TABLAS_PUBLICAS.map((t) => `grant select on "${t}" to ${ROL_PUBLICO}`),
    `grant select (${columnas}) on "donaciones" to ${ROL_PUBLICO}`,
    // Límites de recursos (defensa en profundidad): una consulta pública no puede quedarse colgada ni acaparar la base.
    `alter role ${ROL_PUBLICO} connection limit ${LIMITE_CONEXIONES}`,
    `alter role ${ROL_PUBLICO} set statement_timeout = '${TIEMPO_MAXIMO_CONSULTA}'`,
  ];
}

// Comprobación en ejecución (ADR 0011): la conexión de lo público DEBE ser este rol y NO debe poder leer apoyantes.
// Si en Vercel se pusiera por error la cadena del propietario, todo funcionaría pero el aislamiento quedaría anulado
// sin aviso; esto lo convierte en un fallo visible. Sin Next: lo usan lib/public-queries.ts y las pruebas.
export type EjecutorSql = { execute: (consulta: ReturnType<typeof sql>) => Promise<{ rows: Record<string, unknown>[] }> };

export async function comprobarRolPublico(db: EjecutorSql): Promise<void> {
  const { rows } = await db.execute(
    sql`select current_user::text as usuario, has_table_privilege(current_user, 'apoyantes', 'select') as ve_apoyantes`,
  );
  const fila = rows[0];
  if (fila?.usuario !== ROL_PUBLICO) {
    throw new Error(`DATABASE_URL_PUBLICO no es el rol ${ROL_PUBLICO}`);
  }
  if (fila.ve_apoyantes !== false) {
    throw new Error(`El rol ${ROL_PUBLICO} puede leer apoyantes: permisos incorrectos`);
  }
}
