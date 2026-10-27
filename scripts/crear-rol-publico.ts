import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { ROL_PUBLICO, sentenciasPermisos } from "../lib/rol-publico";

neonConfig.webSocketConstructor = ws;

// Crea (o actualiza) el rol de solo lectura de la zona pública y sus permisos (ADR 0011). Repetible.
//   npm run db:rol-publico -- --prueba                       rama de pruebas (DATABASE_URL_TEST)
//   npm run db:rol-publico -- --confirmar-produccion         base real (DATABASE_URL_UNPOOLED)
//   ... --rotar                                              cambia la contraseña de un rol que ya existe
// La contraseña sale de PUBLICO_LECTURA_PASSWORD y nunca se imprime.

const MIN_PASSWORD = 24;

export function validarPassword(password: string | undefined): string {
  if (!password) throw new Error("Falta la variable de entorno PUBLICO_LECTURA_PASSWORD");
  if (password.length < MIN_PASSWORD) {
    throw new Error(`PUBLICO_LECTURA_PASSWORD debe tener al menos ${MIN_PASSWORD} caracteres`);
  }
  return password;
}

type Opciones = { prueba: boolean; confirmarProduccion: boolean; rotar: boolean };

// "ep-xxx-pooler.region..." y "ep-xxx.region..." son el mismo endpoint (mismo criterio que tests/test-db.ts).
const endpoint = (url: string) => new URL(url).host.replace("-pooler", "");

export function elegirDestino(env: Record<string, string | undefined>, o: Opciones): string {
  if (o.prueba) {
    if (!env.DATABASE_URL_TEST) throw new Error("Falta la variable de entorno DATABASE_URL_TEST");
    // --prueba no pide confirmación: por eso se comprueba que DATABASE_URL_TEST no sea la base real.
    for (const nombre of ["DATABASE_URL", "DATABASE_URL_UNPOOLED"] as const) {
      const real = env[nombre];
      if (real && endpoint(real) === endpoint(env.DATABASE_URL_TEST)) {
        throw new Error(`DATABASE_URL_TEST apunta al mismo endpoint que ${nombre}: --prueba no escribe en la base real`);
      }
    }
    return env.DATABASE_URL_TEST;
  }
  if (!o.confirmarProduccion) {
    throw new Error("Esto escribe en la base REAL. Usa --prueba para la rama de pruebas o --confirmar-produccion.");
  }
  if (!env.DATABASE_URL_UNPOOLED) throw new Error("Falta la variable de entorno DATABASE_URL_UNPOOLED");
  return env.DATABASE_URL_UNPOOLED;
}

async function main() {
  const args = process.argv.slice(2);
  const opciones: Opciones = {
    prueba: args.includes("--prueba"),
    confirmarProduccion: args.includes("--confirmar-produccion"),
    rotar: args.includes("--rotar"),
  };
  const url = elegirDestino(process.env, opciones);

  const pool = new Pool({ connectionString: url });
  try {
    const existe = await pool.query("select 1 from pg_roles where rolname = $1", [ROL_PUBLICO]);
    if (existe.rowCount === 0 || opciones.rotar) {
      // La contraseña solo hace falta para crear el rol o rotarla; validar antes de escribir nada.
      const password = validarPassword(process.env.PUBLICO_LECTURA_PASSWORD);
      // CREATE/ALTER ROLE no admite parámetros: el servidor arma la sentencia con quote_literal.
      const verbo = existe.rowCount === 0 ? "create" : "alter";
      const { rows } = await pool.query("select format($1::text || ' role %I login password %L', $2::text, $3::text) as sentencia", [
        verbo,
        ROL_PUBLICO,
        password,
      ]);
      await pool.query(rows[0].sentencia);
      console.log(`Rol ${ROL_PUBLICO}: ${existe.rowCount === 0 ? "creado" : "contraseña actualizada"}`);
    } else {
      console.log(`Rol ${ROL_PUBLICO}: ya existía (la contraseña no cambia; usa --rotar para cambiarla)`);
    }
    // En una sola transacción: si algo falla, el rol no queda con permisos a medias.
    const cliente = await pool.connect();
    try {
      await cliente.query("begin");
      for (const sentencia of sentenciasPermisos()) await cliente.query(sentencia);
      await cliente.query("commit");
    } catch (e) {
      await cliente.query("rollback").catch(() => undefined);
      throw e;
    } finally {
      cliente.release();
    }
    console.log("Permisos aplicados");
  } finally {
    await pool.end();
  }
}

// Solo corre como script, no al importarlo desde una prueba.
if (process.argv[1] && /crear-rol-publico\.ts$/.test(process.argv[1])) {
  main().catch((e: Error) => {
    console.error("ERROR:", e.message);
    process.exitCode = 1;
  });
}
