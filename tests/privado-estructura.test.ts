import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const RAIZ = join(import.meta.dirname, "..");

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

const PROHIBIDOS = /from\s+["'](?:@\/|(?:\.\.?\/)+)(?:lib\/)?(?:db|db-client|schema)["']|from\s+["']drizzle-orm/;

describe("ADR 0009: la zona privada no consulta tablas directamente", () => {
  test("ningún archivo de app/(privado) importa la base, el esquema ni drizzle", () => {
    const encontrados = archivos(join(RAIZ, "app", "(privado)"))
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .filter((f) => PROHIBIDOS.test(readFileSync(f, "utf8")));
    assert.deepEqual(encontrados, []);
  });

  test("ningún módulo de acceso privado usa \"use cache\"", () => {
    const modulos = ["private-access.ts", "private-queries.ts", "private-queries-core.ts", "responsable-activo.ts"];
    const conCache = modulos.filter((m) => /["']use cache/.test(readFileSync(join(RAIZ, "lib", m), "utf8")));
    assert.deepEqual(conCache, []);
  });

  test("private-queries solo exporta consultas creadas por la fábrica con comprobación", () => {
    const fuente = readFileSync(join(RAIZ, "lib", "private-queries.ts"), "utf8");
    assert.match(fuente, /crearConsultasPrivadas\(requireResponsableActivo, \(\) => getDb\(\)\)/);
    assert.doesNotMatch(fuente, /drizzle|schema|\.select\(|\.insert\(/);
  });
});
