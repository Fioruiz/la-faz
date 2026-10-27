import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, test } from "node:test";
import { crearApoyanteEsquema, editarApoyanteEsquema } from "../lib/apoyantes-esquemas";

const RAIZ = join(import.meta.dirname, "..");

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

const modulosDeApoyantes = () =>
  [
    join(RAIZ, "lib", "apoyantes-escrituras.ts"),
    join(RAIZ, "lib", "apoyantes-esquemas.ts"),
    join(RAIZ, "lib", "apoyantes-publico.ts"),
    ...archivos(join(RAIZ, "app", "(privado)", "apoyantes")),
  ].filter((f) => /\.(ts|tsx)$/.test(f));

describe("apoyantes: sin borrado, datos mínimos y contacto fuera del historial", () => {
  test("ningún módulo ni acción de apoyantes elimina filas", () => {
    const conBorrado = modulosDeApoyantes()
      .filter((f) => /\.delete\(|\bdelete\s+from\b/i.test(readFileSync(f, "utf8")))
      .map((f) => relative(RAIZ, f));
    assert.deepEqual(conBorrado, []);
  });

  test("las escrituras no pasan el valor del contacto al historial", () => {
    const fuente = readFileSync(join(RAIZ, "lib", "apoyantes-escrituras.ts"), "utf8");
    const bloques = [...fuente.matchAll(/(antes|despues):\s*([^\n]+)/g)].map((m) => m[2]);
    assert.ok(bloques.length >= 3);
    for (const b of bloques) assert.doesNotMatch(b, /\bcontacto\b/, b);
    // El historial se arma solo con valoresHistorial(), que nunca copia el contacto.
    const funcion = /const valoresHistorial[\s\S]*?\}\);/.exec(fuente)?.[0] ?? "";
    assert.match(funcion, /tieneContacto/);
    assert.doesNotMatch(funcion, /contacto:/);
  });

  test("los esquemas solo admiten nombre, contacto, roles y anonimato", () => {
    const permitidos = ["anonimoPublico", "contacto", "esDonante", "esVoluntario", "nombre"];
    const entrada = { nombre: "X", esDonante: "on", dni: "1", direccion: "a", nacimiento: "b", cuenta: "c" };
    assert.deepEqual(Object.keys(crearApoyanteEsquema.parse(entrada)).sort(), permitidos);
    assert.deepEqual(Object.keys(editarApoyanteEsquema.parse({ ...entrada, apoyanteId: 1 })).sort(), [...permitidos, "apoyanteId"].sort());
  });

  test("el formulario solo tiene los campos permitidos", () => {
    const fuente = readFileSync(join(RAIZ, "app", "(privado)", "apoyantes", "formularios.tsx"), "utf8");
    const nombres = [...fuente.matchAll(/name="([^"]+)"/g)].map((m) => m[1]).sort();
    assert.deepEqual(nombres, ["anonimoPublico", "apoyanteId", "contacto", "esDonante", "esVoluntario", "nombre"]);
  });
});
