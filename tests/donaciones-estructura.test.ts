import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, test } from "node:test";

const RAIZ = join(import.meta.dirname, "..");

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

const modulosDeDonaciones = () =>
  [
    join(RAIZ, "lib", "donaciones-escrituras.ts"),
    join(RAIZ, "lib", "donaciones-esquemas.ts"),
    join(RAIZ, "lib", "donaciones-reglas.ts"),
    join(RAIZ, "lib", "donaciones-correcciones.ts"),
    join(RAIZ, "lib", "donaciones-correcciones-esquemas.ts"),
    ...archivos(join(RAIZ, "app", "(privado)", "donaciones")),
  ].filter((f) => /\.(ts|tsx)$/.test(f));

describe("donaciones: solo registrar, sin estado desde la entrada", () => {
  test("ningún módulo de donaciones elimina filas", () => {
    const conBorrado = modulosDeDonaciones()
      .filter((f) => /\.delete\(|\bdelete\s+from\b/i.test(readFileSync(f, "utf8")))
      .map((f) => relative(RAIZ, f));
    assert.deepEqual(conBorrado, []);
  });

  test("el responsable y la anulación nunca salen de la entrada", () => {
    const escritura = readFileSync(join(RAIZ, "lib", "donaciones-escrituras.ts"), "utf8");
    assert.match(escritura, /registradoPor:\s*responsable\.id/);
    assert.doesNotMatch(escritura, /datos\.(registradoPor|anulada|responsableId)/);
    const esquema = readFileSync(join(RAIZ, "lib", "donaciones-esquemas.ts"), "utf8");
    assert.doesNotMatch(esquema, /registradoPor|anulada|responsableId/);
  });

  test("ningún módulo de donaciones restaura una anulada (anulada: false no se escribe)", () => {
    const restaura = modulosDeDonaciones()
      .filter((f) => /anulada:\s*false/.test(readFileSync(f, "utf8").replace(/antes:[^\n]*/g, "")))
      .map((f) => relative(RAIZ, f));
    assert.deepEqual(restaura, []);
  });

  test("las correcciones no toman el tipo, el donante ni el responsable de la entrada", () => {
    const correcciones = readFileSync(join(RAIZ, "lib", "donaciones-correcciones.ts"), "utf8");
    assert.doesNotMatch(correcciones, /\.set\(\{[^}]*(registradoPor|apoyanteId|tipo)\b/);
    assert.doesNotMatch(correcciones, /entrada\.(tipo|apoyanteId|registradoPor)/);
    assert.match(correcciones, /tipo: previa\.tipo, apoyanteId: previa\.apoyanteId/);
  });

  test("la acción usa el patrón de escritura auditada", () => {
    const accion = readFileSync(join(RAIZ, "app", "(privado)", "donaciones", "actions.ts"), "utf8");
    assert.match(accion, /from\s+["']@\/lib\/escritura-auditada["']/);
    assert.equal((accion.match(/crearAccionPrivada\(/g) ?? []).length, 4);
  });

  test("el historial de la donación no guarda nombre ni contacto del donante", () => {
    const escritura = readFileSync(join(RAIZ, "lib", "donaciones-escrituras.ts"), "utf8");
    const despues = /despues:\s*\{[\s\S]*?\n\s{10}\},/.exec(escritura)?.[0] ?? "";
    assert.match(despues, /apoyanteId/);
    assert.doesNotMatch(despues, /nombre|contacto/i);
  });
});
