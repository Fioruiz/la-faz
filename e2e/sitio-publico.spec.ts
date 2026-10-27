import { expect, test } from "@playwright/test";
import { vaciarContadoresDelFormulario } from "./soporte-db";

// Solo lecturas: no envían formularios ni crean datos.
test("el inicio y las páginas públicas cargan", async ({ page }) => {
  for (const ruta of ["/", "/quienes-somos", "/como-donar", "/voluntariado", "/nuestros-proyectos"]) {
    const respuesta = await page.goto(ruta);
    expect(respuesta?.status(), ruta).toBe(200);
  }
});

test("el formulario de voluntariado tiene sus campos y el campo trampa no se ve", async ({ page }) => {
  await page.goto("/voluntariado");
  await expect(page.getByLabel("Nombre", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Contacto (teléfono o correo)", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox")).toBeVisible();
  await expect(page.getByRole("button", { name: "Inscribirme" })).toBeVisible();
  // Campo trampa: fuera de pantalla, fuera del árbol de accesibilidad y sin foco por teclado.
  const trampa = page.locator('input[name="sitio_web"]');
  await expect(trampa).toHaveAttribute("tabindex", "-1");
  await expect(trampa).toHaveAttribute("autocomplete", "off");
  await expect(page.getByRole("textbox", { name: "No llenar este campo" })).toHaveCount(0);
  const caja = await trampa.boundingBox();
  expect(caja === null || caja.x + caja.width < 0).toBe(true);
});

test.describe("envío del formulario", () => {
  test.beforeEach(vaciarContadoresDelFormulario);
  test.afterEach(vaciarContadoresDelFormulario);

test("enviar el formulario vacío muestra los errores sin guardar nada", async ({ page }) => {
  await page.goto("/voluntariado");
  await page.waitForLoadState("networkidle"); // el formulario es un componente cliente: esperar a que se hidrate
  await page.getByRole("button", { name: "Inscribirme" }).click();
  // La primera llamada a la acción compila en modo desarrollo: más margen que los 5 s por defecto.
  await expect(page.getByText("Escribe tu nombre")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Debes aceptar el uso de tus datos")).toBeVisible();
});
});

test("la zona privada pide iniciar sesión", async ({ page }) => {
  for (const ruta of ["/panel", "/apoyantes", "/voluntarios", "/donaciones"]) {
    await page.goto(ruta);
    await expect(page, ruta).toHaveURL(/\/login/);
  }
});

test("la lista pública de proyectos no muestra montos ni la página de error", async ({ page }) => {
  await page.goto("/nuestros-proyectos");
  await expect(page.locator("main")).not.toContainText("S/");
  await expect(page.locator("main")).not.toContainText(/no pudimos/i);
});
