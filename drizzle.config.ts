import { defineConfig } from "drizzle-kit";

// drizzle-kit no carga .env.local por sí solo.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin archivo: puede que la variable ya venga del entorno.
}

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  throw new Error("Falta la variable de entorno DATABASE_URL_UNPOOLED");
}

// Las migraciones usan la conexión directa de Neon, no la del pooler.
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
