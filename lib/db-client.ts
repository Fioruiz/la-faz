import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

// Node 20 no trae WebSocket global; el Pool de Neon lo necesita para las transacciones.
neonConfig.webSocketConstructor = ws;

let pool: Pool | undefined;
let db: ReturnType<typeof createDb> | undefined;

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Falta la variable de entorno DATABASE_URL");
  }
  return url;
}

function createDb(client: Pool) {
  return drizzle({ client, schema });
}

// Perezoso: la variable se lee al usar la base, no al importar el módulo,
// para que `next build` no falle en rutas que no la consultan.
export function getPool(): Pool {
  pool ??= new Pool({ connectionString: getConnectionString() });
  return pool;
}

export function getDb() {
  db ??= createDb(getPool());
  return db;
}
