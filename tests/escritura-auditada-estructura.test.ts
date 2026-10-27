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

// Acciones privadas que no escriben en la base y por eso no usan el patrón.
const SIN_ESCRITURA = ["app/(privado)/panel/actions.ts"]; // cerrarSesion

const USA_EL_PATRON = /from\s+["']@\/lib\/escritura-auditada["']/;

describe("ADR 0003: las acciones privadas de escritura usan el patrón", () => {
  test("toda acción \"use server\" de app/(privado) importa lib/escritura-auditada, salvo las que no escriben", () => {
    const acciones = archivos(join(RAIZ, "app", "(privado)")).filter((f) => /\.(ts|tsx)$/.test(f));
    const sinPatron = acciones
      .filter((f) => /^\s*["']use server["']/m.test(readFileSync(f, "utf8")))
      .filter((f) => !USA_EL_PATRON.test(readFileSync(f, "utf8")))
      .map((f) => relative(RAIZ, f))
      .filter((f) => !SIN_ESCRITURA.includes(f));
    assert.deepEqual(sinPatron, []);
  });

  test("las excepciones permitidas existen y no tocan la base", () => {
    for (const ruta of SIN_ESCRITURA) {
      const fuente = readFileSync(join(RAIZ, ruta), "utf8");
      assert.doesNotMatch(fuente, /db-client|@\/lib\/db|schema|drizzle/);
    }
  });

  test("lib/escritura-auditada.ts es solo de servidor", () => {
    assert.match(readFileSync(join(RAIZ, "lib", "escritura-auditada.ts"), "utf8"), /^import "server-only";/m);
  });
});
