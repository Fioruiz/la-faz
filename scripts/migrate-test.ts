import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { createTestDb } from "../tests/test-db";

// Aplica las migraciones a la rama de pruebas. Repetirlo no cambia nada.
const { pool, db } = createTestDb();

migrate(db, { migrationsFolder: "./drizzle" })
  .then(() => console.log("Migraciones aplicadas a la rama de pruebas"))
  .catch((e: Error) => {
    console.error("ERROR:", e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
