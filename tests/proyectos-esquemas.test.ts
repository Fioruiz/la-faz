import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  crearItemEsquema,
  crearProyectoEsquema,
  editarItemEsquema,
  editarProyectoEsquema,
  finalizarProyectoEsquema,
} from "../lib/proyectos-esquemas";

const errorDe = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }, campo: string) =>
  r.error?.issues.find((i) => i.path[0] === campo)?.message;

describe("esquema de proyecto", () => {
  test("válido: recorta, vacío a null y casilla a booleano", () => {
    const r = crearProyectoEsquema.parse({ nombre: "  Navidad  ", descripcion: "   ", tieneMeta: "on" });
    assert.deepEqual(r, { nombre: "Navidad", descripcion: null, tieneMeta: true });
    assert.equal(crearProyectoEsquema.parse({ nombre: "X" }).tieneMeta, false);
  });

  test("nombre vacío o de 101 caracteres", () => {
    assert.ok(errorDe(crearProyectoEsquema.safeParse({ nombre: "   " }), "nombre"));
    assert.ok(errorDe(crearProyectoEsquema.safeParse({}), "nombre"));
    assert.ok(errorDe(crearProyectoEsquema.safeParse({ nombre: "x".repeat(101) }), "nombre"));
    assert.equal(crearProyectoEsquema.safeParse({ nombre: "x".repeat(100) }).success, true);
  });

  test("descripción de 1001 caracteres", () => {
    assert.ok(errorDe(crearProyectoEsquema.safeParse({ nombre: "X", descripcion: "d".repeat(1001) }), "descripcion"));
    assert.equal(crearProyectoEsquema.safeParse({ nombre: "X", descripcion: "d".repeat(1000) }).success, true);
  });

  test("editar exige un id de proyecto válido", () => {
    assert.equal(editarProyectoEsquema.parse({ proyectoId: "7", nombre: "X" }).proyectoId, 7);
    for (const malo of ["", "abc", "0", "-1", "1.5", undefined]) {
      assert.ok(errorDe(editarProyectoEsquema.safeParse({ proyectoId: malo, nombre: "X" }), "proyectoId"), String(malo));
    }
  });
});

describe("esquema de finalizar", () => {
  test("resultado vacío, de 2001 caracteres y válido", () => {
    assert.ok(errorDe(finalizarProyectoEsquema.safeParse({ proyectoId: "1", resultado: "  " }), "resultado"));
    assert.ok(errorDe(finalizarProyectoEsquema.safeParse({ proyectoId: "1", resultado: "r".repeat(2001) }), "resultado"));
    assert.equal(finalizarProyectoEsquema.parse({ proyectoId: "1", resultado: " Se entregaron 1850 packs " }).resultado, "Se entregaron 1850 packs");
  });
});

const item = (extra: Record<string, unknown> = {}) => ({ proyectoId: "1", nombre: "Pack", unidad: "pack", cantidadMeta: "2000", ...extra });

describe("esquema de ítem", () => {
  test("válido sin costo: costo null", () => {
    const r = crearItemEsquema.parse(item());
    assert.deepEqual(r, { proyectoId: 1, nombre: "Pack", unidad: "pack", cantidadMeta: 2000, costoReferencial: null });
  });

  test("nombre y unidad: vacíos y por encima del tope", () => {
    assert.ok(errorDe(crearItemEsquema.safeParse(item({ nombre: "" })), "nombre"));
    assert.ok(errorDe(crearItemEsquema.safeParse(item({ nombre: "n".repeat(101) })), "nombre"));
    assert.ok(errorDe(crearItemEsquema.safeParse(item({ unidad: "" })), "unidad"));
    assert.ok(errorDe(crearItemEsquema.safeParse(item({ unidad: "u".repeat(31) })), "unidad"));
    assert.equal(crearItemEsquema.safeParse(item({ unidad: "u".repeat(30) })).success, true);
  });

  test("meta: 0, negativa, decimal, texto, vacía y 1.000.001 se rechazan; 1 y 1.000.000 pasan", () => {
    for (const mala of ["0", "-5", "2.5", "abc", "", "1000001"]) {
      assert.ok(errorDe(crearItemEsquema.safeParse(item({ cantidadMeta: mala })), "cantidadMeta"), `meta ${mala}`);
    }
    for (const buena of ["1", "1000000"]) {
      assert.equal(crearItemEsquema.safeParse(item({ cantidadMeta: buena })).success, true, `meta ${buena}`);
    }
  });

  test("costo: punto, coma, entero y vacío válidos", () => {
    const costo = (c: string | undefined) => crearItemEsquema.parse(item({ costoReferencial: c })).costoReferencial;
    assert.equal(costo("13"), "13.00");
    assert.equal(costo("13.5"), "13.50");
    assert.equal(costo("13,50"), "13.50");
    assert.equal(costo("9999999.99"), "9999999.99");
    assert.equal(costo(""), null);
    assert.equal(costo("   "), null);
    assert.equal(costo(undefined), null);
  });

  test("costo: cero, negativo, tres decimales, texto y por encima del tope se rechazan", () => {
    for (const malo of ["0", "0,00", "-1", "13.505", "abc", "10000000", "1,2,3", "$13"]) {
      assert.ok(errorDe(crearItemEsquema.safeParse(item({ costoReferencial: malo })), "costoReferencial"), `costo ${malo}`);
    }
  });

  test("editar exige id de proyecto y de ítem", () => {
    assert.equal(editarItemEsquema.safeParse(item({ itemId: "3" })).success, true);
    assert.ok(errorDe(editarItemEsquema.safeParse(item()), "itemId"));
    assert.ok(errorDe(editarItemEsquema.safeParse(item({ itemId: "x" })), "itemId"));
  });
});
