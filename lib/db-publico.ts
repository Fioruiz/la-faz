import "server-only";

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

// Conexión de la ZONA PÚBLICA (ADR 0011): usa el rol de solo lectura publico_lectura, que la base limita a lo que
// muestra la web (lib/rol-publico.ts). Es obligatoria y NO hay caída a DATABASE_URL: sin ella, la zona pública
// falla de forma visible (error.tsx) en vez de leer con plena autoridad o mostrar un avance en cero.
neonConfig.webSocketConstructor = ws;

let pool: Pool | undefined;
let db: ReturnType<typeof createDb> | undefined;

function createDb(client: Pool) {
  return drizzle({ client, schema });
}

export function getDbPublico() {
  if (!db) {
    const url = process.env.DATABASE_URL_PUBLICO;
    if (!url) throw new Error("Falta la variable de entorno DATABASE_URL_PUBLICO");
    pool = new Pool({ connectionString: url });
    db = createDb(pool);
  }
  return db;
}
