import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, test } from "node:test";

const RAIZ = join(import.meta.dirname, "..");
const leer = (...partes: string[]) => readFileSync(join(RAIZ, ...partes), "utf8");
const MODULOS = ["reporte.ts", "reporte-consulta.ts"];

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

// El PRD deja la exportación fuera de alcance ("No alcance"): cualquier librería o ruta de descarga la rompe.
const LIBRERIAS_DE_EXPORTACION = /^(xlsx|exceljs|sheetjs|pdfkit|pdf-lib|pdfmake|jspdf|react-pdf|@react-pdf\/.*|puppeteer|playwright|csv-stringify|csv-writer|json2csv|papaparse|fast-csv|file-saver)$/i;

describe("PRD (No alcance): el reporte no se exporta", () => {
  test("no hay librerías de Excel, PDF ni CSV entre las dependencias", () => {
    const paquete = JSON.parse(leer("package.json")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const nombres = [...Object.keys(paquete.dependencies ?? {}), ...Object.keys(paquete.devDependencies ?? {})];
    assert.deepEqual(nombres.filter((n) => LIBRERIAS_DE_EXPORTACION.test(n)), []);
  });

  test("la página del reporte no tiene rutas ni código de descarga", () => {
    const carpeta = join(RAIZ, "app", "(privado)", "reportes");
    const todos = archivos(carpeta);
    assert.deepEqual(todos.filter((f) => /route\.(ts|js)$/.test(f)).map((f) => relative(RAIZ, f)), []);
    const conDescarga = todos
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .filter((f) => /text\/csv|Content-Disposition|\bdownload\b|\bBlob\b|createObjectURL|exportar|\.xlsx|\.pdf/i.test(readFileSync(f, "utf8")))
      .map((f) => relative(RAIZ, f));
    assert.deepEqual(conDescarga, []);
  });

  test("no hay ninguna ruta de API del reporte", () => {
    assert.equal(existsSync(join(RAIZ, "app", "api", "reportes")), false);
    assert.equal(existsSync(join(RAIZ, "app", "reportes")), false);
  });
});

describe("el reporte reutiliza la regla de vigente, no toca donantes y no usa coma flotante", () => {
  test("ni el avance ni el reporte escriben la regla de anuladas por su cuenta", () => {
    for (const modulo of [...MODULOS, "avance-consulta.ts"]) {
      assert.doesNotMatch(leer("lib", modulo), /donaciones\.anulada/, `${modulo} escribe el filtro de anuladas`);
    }
    assert.match(leer("lib", "reporte-consulta.ts"), /from\s+["']\.\/donaciones-condiciones["']/);
    assert.match(leer("lib", "avance-consulta.ts"), /from\s+["']\.\/donaciones-condiciones["']/);
  });

  test("los módulos del reporte no leen apoyantes ni contactos y no dependen de Next ni de lo privado", () => {
    for (const modulo of MODULOS) {
      // Sin comentarios: pueden mencionar a los apoyantes para decir que NO se tocan.
      const fuente = leer("lib", modulo).replace(/^import type .*$/gm, "").replace(/\/\/.*$/gm, "");
      assert.doesNotMatch(fuente, /apoyantes|contacto/i, `${modulo} toca datos de donantes`);
      assert.doesNotMatch(fuente, /from\s+["'](next|server-only)/, `${modulo} importa Next`);
      assert.doesNotMatch(fuente, /from\s+["']\.\/(private-|auth|zona-privada|responsable-activo)/, `${modulo} importa módulos privados`);
    }
  });

  test("los montos no se calculan con coma flotante", () => {
    for (const modulo of MODULOS) {
      const fuente = leer("lib", modulo).replace(/\/\/.*$/gm, "");
      assert.doesNotMatch(fuente, /parseFloat|toFixed/, `${modulo} usa coma flotante`);
      const lineas = fuente.split("\n").filter((l) => /monto|costo|dinero|soles|total/i.test(l) && /\bNumber\(/.test(l));
      assert.deepEqual(lineas, [], `${modulo} convierte montos con Number()`);
    }
  });
});
