import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { crearApoyanteEsquema, editarApoyanteEsquema } from "../lib/apoyantes-esquemas";

const base = (extra: Record<string, unknown> = {}) => ({ nombre: "Rosa Quispe", esDonante: "on", ...extra });
const errorDe = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }, campo: string) =>
  r.error?.issues.find((i) => i.path[0] === campo)?.message;

describe("esquema de apoyante", () => {
  test("válido: recorta, contacto vacío a null y anonimato por defecto falso", () => {
    const r = crearApoyanteEsquema.parse(base({ nombre: "  Rosa Quispe ", contacto: "   " }));
    assert.deepEqual(r, { nombre: "Rosa Quispe", contacto: null, esDonante: true, esVoluntario: false, anonimoPublico: false });
  });

  test("nombre vacío o de 101 caracteres; 100 pasa", () => {
    assert.ok(errorDe(crearApoyanteEsquema.safeParse(base({ nombre: "  " })), "nombre"));
    assert.ok(errorDe(crearApoyanteEsquema.safeParse(base({ nombre: "n".repeat(101) })), "nombre"));
    assert.equal(crearApoyanteEsquema.safeParse(base({ nombre: "n".repeat(100) })).success, true);
  });

  test("contacto de 201 caracteres falla y de 200 pasa", () => {
    assert.ok(errorDe(crearApoyanteEsquema.safeParse(base({ contacto: "c".repeat(201) })), "contacto"));
    assert.equal(crearApoyanteEsquema.safeParse(base({ contacto: "c".repeat(200) })).success, true);
  });

  test("ningún rol: error en la clave roles", () => {
    const r = crearApoyanteEsquema.safeParse({ nombre: "X" });
    assert.equal(errorDe(r, "roles"), "Elige al menos un rol");
  });

  test("un rol o los dos roles pasan", () => {
    assert.equal(crearApoyanteEsquema.safeParse({ nombre: "X", esVoluntario: "on" }).success, true);
    const dos = crearApoyanteEsquema.parse({ nombre: "X", esDonante: "on", esVoluntario: "on" });
    assert.deepEqual([dos.esDonante, dos.esVoluntario], [true, true]);
  });

  test("la marca de anonimato se lee de la casilla", () => {
    assert.equal(crearApoyanteEsquema.parse(base({ anonimoPublico: "on" })).anonimoPublico, true);
  });

  test("editar exige un id de apoyante válido", () => {
    assert.equal(editarApoyanteEsquema.parse(base({ apoyanteId: "5" })).apoyanteId, 5);
    for (const malo of ["", "abc", "0", "-1", "1.5", undefined]) {
      assert.ok(errorDe(editarApoyanteEsquema.safeParse(base({ apoyanteId: malo })), "apoyanteId"), String(malo));
    }
  });

  test("campos desconocidos (datos que no se guardan) no llegan al resultado", () => {
    const r = crearApoyanteEsquema.parse(base({ dni: "12345678", direccion: "Av. X" }));
    assert.deepEqual(Object.keys(r).sort(), ["anonimoPublico", "contacto", "esDonante", "esVoluntario", "nombre"]);
  });
});
