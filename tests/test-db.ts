import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "../lib/schema";

neonConfig.webSocketConstructor = ws;

// "ep-xxx-pooler.region.aws.neon.tech" y "ep-xxx.region.aws.neon.tech" son el mismo endpoint.
function endpoint(url: string): string {
  return new URL(url).host.replace("-pooler", "");
}

export function getTestConnectionString(): string {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error("Falta la variable de entorno DATABASE_URL_TEST (archivo .env.test)");
  }
  // Las pruebas insertan filas inválidas a propósito: nunca deben apuntar a la base real.
  for (const name of ["DATABASE_URL", "DATABASE_URL_UNPOOLED"]) {
    const real = process.env[name];
    if (real && endpoint(real) === endpoint(url)) {
      throw new Error(`DATABASE_URL_TEST apunta al mismo endpoint que ${name}; las pruebas no corren contra la base real`);
    }
  }
  return url;
}

export function createTestDb() {
  const pool = new Pool({ connectionString: getTestConnectionString() });
  return { pool, db: drizzle({ client: pool, schema }) };
}
