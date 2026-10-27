import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { apoyantes, donaciones } from "../lib/schema";
import { asegurarProyecto, crearResponsableDePrueba, db, limpiar, sufijo } from "./soporte-db";

// Flujo completo de un responsable: login, crear un donante y registrar una donación en dinero para "10 Derechos".
// Escribe en la RAMA DE PRUEBAS (nunca producción) y borra todo al terminar.
const PASSWORD = "ClaveE2E-Prueba-123";
const NOMBRE_DONANTE = `Donante E2E ${sufijo()}`;
const MONTO = "50,50";

let responsable: { id: number; correo: string };
let proyecto: { id: number; creado: boolean };

test.beforeAll(async () => {
  responsable = await crearResponsableDePrueba(PASSWORD);
  proyecto = await asegurarProyecto("10 Derechos", true);
});

test.afterAll(async () => {
  const creados = await db.select({ id: apoyantes.id }).from(apoyantes).where(eq(apoyantes.nombre, NOMBRE_DONANTE));
  await limpiar(responsable.id, creados.map((a) => a.id), proyecto.creado ? proyecto.id : undefined);
});

test("un responsable crea un donante y registra una donación en dinero para 10 Derechos", async ({ page }) => {
  // 1. Login
  await page.goto("/login");
  await page.getByLabel("Correo").fill(responsable.correo);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/panel/);

  // 2. Crear el donante (rol de donante por defecto)
  await page.goto("/apoyantes/nuevo");
  await page.getByLabel("Nombre", { exact: true }).fill(NOMBRE_DONANTE);
  await page.getByLabel(/Contacto/).fill("999 000 111");
  await page.getByRole("button", { name: "Crear apoyante" }).click();
  await expect(page).toHaveURL(/\/apoyantes\/\d+$/);
  await expect(page.getByRole("heading", { name: NOMBRE_DONANTE })).toBeVisible();

  // 3. Registrar la donación en dinero para 10 Derechos
  await page.goto("/donaciones/nueva");
  const opcionDonante = page.locator("select[name=apoyanteId] option", { hasText: NOMBRE_DONANTE });
  await page.locator("select[name=apoyanteId]").selectOption((await opcionDonante.getAttribute("value")) ?? "");
  await page.locator("select[name=proyectoId]").selectOption({ label: "10 Derechos" });
  await page.locator("input[name=monto]").fill(MONTO);
  await page.locator("select[name=medio]").selectOption("yape");
  await page.getByRole("button", { name: "Registrar donación" }).click();
  await expect(page.getByRole("heading", { name: "Donación registrada" })).toBeVisible();

  // 4. La donación quedó guardada en la base: del donante, en dinero, para 10 Derechos
  const [donante] = await db.select().from(apoyantes).where(eq(apoyantes.nombre, NOMBRE_DONANTE));
  const guardadas = await db
    .select()
    .from(donaciones)
    .where(and(eq(donaciones.apoyanteId, donante.id), eq(donaciones.proyectoId, proyecto.id)));
  expect(guardadas).toHaveLength(1);
  expect(guardadas[0]).toMatchObject({ tipo: "dinero", monto: "50.50", medio: "yape", anulada: false, registradoPor: responsable.id });
  expect(donante).toMatchObject({ esDonante: true, esVoluntario: false });
});
