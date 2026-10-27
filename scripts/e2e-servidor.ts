import { spawn } from "node:child_process";

// Servidor de las pruebas E2E: Next en desarrollo contra la RAMA DE PRUEBAS de Neon, nunca contra producción.
// Pone DATABASE_URL* a partir de DATABASE_URL_TEST y DATABASE_URL_PUBLICO a partir de DATABASE_URL_TEST_PUBLICO,
// y se niega a arrancar si la de pruebas es el mismo servidor que la real.
for (const archivo of [".env.local", ".env.test"]) {
  try {
    process.loadEnvFile(archivo);
  } catch {
    // Sin el archivo: la variable puede venir del entorno.
  }
}

const endpoint = (url: string) => new URL(url).host.replace("-pooler", "");
const { DATABASE_URL_TEST: prueba, DATABASE_URL_TEST_PUBLICO: publico, DATABASE_URL: real, DATABASE_URL_UNPOOLED: realDirecta } = process.env;

if (!prueba || !publico) {
  console.error("ERROR: faltan DATABASE_URL_TEST o DATABASE_URL_TEST_PUBLICO en .env.test");
  process.exit(1);
}
for (const r of [real, realDirecta]) {
  if (r && endpoint(r) === endpoint(prueba)) {
    console.error("ERROR: DATABASE_URL_TEST apunta a la base real; las pruebas E2E no corren contra producción");
    process.exit(1);
  }
}

const puerto = process.env.E2E_PUERTO ?? "3200";
const hijo = spawn("npx", ["next", "dev", "-p", puerto], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: prueba, DATABASE_URL_UNPOOLED: prueba, DATABASE_URL_PUBLICO: publico },
});
for (const senal of ["SIGINT", "SIGTERM"] as const) process.on(senal, () => hijo.kill(senal));
hijo.on("exit", (codigo) => process.exit(codigo ?? 0));
