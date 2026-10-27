import { defineConfig, devices } from "@playwright/test";

// Los tests que preparan datos (e2e/soporte-db.ts) usan la rama de pruebas: se leen sus variables aquí, y los
// workers las heredan. Si el archivo no está, la variable puede venir del entorno.
for (const archivo of [".env.local", ".env.test"]) {
  try {
    process.loadEnvFile(archivo);
  } catch {
    // sin archivo
  }
}

// Pruebas E2E (solo locales): arrancan la app contra la rama de pruebas de Neon (scripts/e2e-servidor.ts).
// Corren con `npm run e2e`. No usan GitHub Actions ni tocan producción.
const puerto = process.env.E2E_PUERTO ?? "3200";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${puerto}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx tsx scripts/e2e-servidor.ts",
    url: `http://localhost:${puerto}`,
    // Por defecto arranca su propio servidor contra la rama de pruebas. Con E2E_REUTILIZAR=1 reutiliza el que ya
    // esté en el puerto (solo si lo levantaste con scripts/e2e-servidor.ts: este modo no comprueba a qué base apunta).
    reuseExistingServer: process.env.E2E_REUTILIZAR === "1",
    timeout: 120_000,
  },
});
