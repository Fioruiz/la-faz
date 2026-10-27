import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

const RAIZ = join(import.meta.dirname, "..");

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

// El PRD no menciona borrar ni reabrir proyectos o ítems (design.md, decisión 8).
test("ningún módulo de proyectos e ítems elimina filas", () => {
  const modulos = [
    join(RAIZ, "lib", "proyectos-escrituras.ts"),
    join(RAIZ, "lib", "proyectos-esquemas.ts"),
    join(RAIZ, "lib", "private-queries-core.ts"),
    ...archivos(join(RAIZ, "app", "(privado)", "proyectos")),
  ].filter((f) => /\.(ts|tsx)$/.test(f));
  const conBorrado = modulos
    .filter((f) => /\.delete\(|\bdelete\s+from\b/i.test(readFileSync(f, "utf8")))
    .map((f) => relative(RAIZ, f));
  assert.deepEqual(conBorrado, []);
});
