import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, test } from "node:test";

const RAIZ = join(import.meta.dirname, "..");
const leer = (...partes: string[]) => readFileSync(join(RAIZ, ...partes), "utf8");
const MODULOS = ["avance.ts", "dinero.ts", "avance-consulta.ts"];

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

describe("A2: una sola función de avance, compartible con la zona pública", () => {
  test("los módulos de avance no dependen de Next ni de la zona privada", () => {
    for (const modulo of MODULOS) {
      // Se ignoran los `import type`: solo traen el tipo de la conexión, no código de la zona privada.
      const fuente = leer("lib", modulo).replace(/^import type .*$/gm, "");
      assert.doesNotMatch(fuente, /from\s+["'](next|server-only)/, `${modulo} importa Next o server-only`);
      assert.doesNotMatch(fuente, /from\s+["']\.\/(private-|auth|zona-privada|responsable-activo)/, `${modulo} importa módulos privados`);
    }
  });

  test("los montos no se calculan con coma flotante", () => {
    for (const modulo of MODULOS) {
      const fuente = leer("lib", modulo);
      assert.doesNotMatch(fuente, /parseFloat|toFixed/, `${modulo} usa coma flotante`);
      const lineas = fuente.split("\n").filter((l) => /monto|costo|dinero|soles|total/i.test(l) && /\bNumber\(/.test(l));
      assert.deepEqual(lineas, [], `${modulo} convierte montos con Number()`);
    }
  });

  test("las lecturas privadas usan la consulta compartida y no suman por su cuenta", () => {
    const nucleo = leer("lib", "private-queries-core.ts");
    assert.match(nucleo, /from\s+["']\.\/avance-consulta["']/);
    assert.doesNotMatch(nucleo, /\bsum\(/i);
  });

  test("las pantallas de proyectos no calculan el avance por su cuenta", () => {
    const paginas = archivos(join(RAIZ, "app", "(privado)", "proyectos")).filter((f) => /\.(ts|tsx)$/.test(f));
    const calculan = paginas
      .filter((f) => /Math\.floor|\.reduce\(|\brecibido\s*[-+*/]|\bcantidadMeta\s*[-+*/]/.test(readFileSync(f, "utf8")))
      .map((f) => relative(RAIZ, f));
    assert.deepEqual(calculan, []);
  });

  test("no hay columnas ni contadores de lo recibido en el esquema", () => {
    const esquema = leer("lib", "schema.ts");
    assert.doesNotMatch(esquema, /cantidad_recibida|cantidadRecibida|recibido/i);
  });
});
