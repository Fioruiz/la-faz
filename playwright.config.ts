import { defineConfig, devices } from "@playwright/test";

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
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
