import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { registrarDonacionEsquema } from "../lib/donaciones-esquemas";

const errorDe = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }, campo: string) =>
  r.error?.issues.find((i) => i.path[0] === campo)?.message;

const dinero = (extra: Record<string, unknown> = {}) => ({
  tipo: "dinero", apoyanteId: "4", proyectoId: "7", fecha: "2026-11-03", monto: "150", medio: "yape", ...extra,
});
const producto = (extra: Record<string, unknown> = {}) => ({
  tipo: "producto", apoyanteId: "4", proyectoId: "7", fecha: "2026-11-03", cantidad: "500", itemId: "9", ...extra,
});

describe("esquema de donación en dinero", () => {
  test("válido: monto normalizado, proyecto como número y casillas a booleano", () => {
    const r = registrarDonacionEsquema.parse(dinero({ monto: "150,5", confirmarDuplicado: "on" }));
    assert.deepEqual(r, { tipo: "dinero", apoyanteId: 4, proyectoId: 7, fecha: "2026-11-03", monto: "150.50", medio: "yape", confirmarDuplicado: true });
  });

  test("monto: punto, coma y entero válidos; límite de 10 enteros", () => {
    const monto = (m: string) => (registrarDonacionEsquema.parse(dinero({ monto: m })) as { monto: string }).monto;
    assert.equal(monto("150"), "150.00");
    assert.equal(monto("150.5"), "150.50");
    assert.equal(monto("150,50"), "150.50");
    assert.equal(monto("9999999999.99"), "9999999999.99");
  });

  test("monto: cero, negativo, tres decimales, texto, vacío y 11 enteros se rechazan", () => {
    for (const malo of ["0", "0,00", "-5", "150.505", "abc", "", "10000000000", "$150"]) {
      assert.ok(errorDe(registrarDonacionEsquema.safeParse(dinero({ monto: malo })), "monto"), `monto ${malo}`);
    }
  });

  test("medio obligatorio y solo los tres permitidos", () => {
    assert.ok(errorDe(registrarDonacionEsquema.safeParse(dinero({ medio: undefined })), "medio"));
    assert.ok(errorDe(registrarDonacionEsquema.safeParse(dinero({ medio: "efectivo" })), "medio"));
    for (const m of ["yape", "plin", "transferencia"]) assert.equal(registrarDonacionEsquema.safeParse(dinero({ medio: m })).success, true, m);
  });
});

describe("esquema de donación en producto", () => {
  test("válido asignado: ítem y cantidad, sin monto ni medio aunque vengan", () => {
    const r = registrarDonacionEsquema.parse(producto({ monto: "99", medio: "yape" }));
    assert.deepEqual(r, { tipo: "producto", apoyanteId: 4, proyectoId: 7, fecha: "2026-11-03", cantidad: 500, itemId: 9, descripcionProducto: null, confirmarDuplicado: false });
    assert.ok(!("monto" in r) && !("medio" in r));
  });

  test("cantidad: 0, negativa, decimal, texto, vacía y 1.000.001 se rechazan; 1 y 1.000.000 pasan", () => {
    for (const mala of ["0", "-1", "2.5", "abc", "", "1000001"]) {
      assert.ok(errorDe(registrarDonacionEsquema.safeParse(producto({ cantidad: mala })), "cantidad"), `cantidad ${mala}`);
    }
    for (const buena of ["1", "1000000"]) assert.equal(registrarDonacionEsquema.safeParse(producto({ cantidad: buena })).success, true, buena);
  });

  test("con proyecto exige el ítem", () => {
    assert.equal(errorDe(registrarDonacionEsquema.safeParse(producto({ itemId: undefined })), "itemId"), "Elige el ítem");
    assert.equal(errorDe(registrarDonacionEsquema.safeParse(producto({ itemId: "" })), "itemId"), "Elige el ítem");
  });

  test("sin asignar exige la descripción de 1 a 200 caracteres y no necesita ítem", () => {
    const sin = (extra: Record<string, unknown>) => producto({ proyectoId: "sin-asignar", itemId: undefined, ...extra });
    assert.equal(errorDe(registrarDonacionEsquema.safeParse(sin({})), "descripcionProducto"), "Describe lo que se recibió");
    assert.equal(errorDe(registrarDonacionEsquema.safeParse(sin({ descripcionProducto: "   " })), "descripcionProducto"), "Describe lo que se recibió");
    assert.ok(errorDe(registrarDonacionEsquema.safeParse(sin({ descripcionProducto: "d".repeat(201) })), "descripcionProducto"));
    const ok = registrarDonacionEsquema.parse(sin({ descripcionProducto: "  Cajas de cereal " }));
    assert.deepEqual([ok.proyectoId, (ok as { descripcionProducto: string | null }).descripcionProducto], [null, "Cajas de cereal"]);
  });
});

describe("campos comunes", () => {
  test("proyecto: vacío es error; sin-asignar es null; id inválido es error", () => {
    assert.equal(errorDe(registrarDonacionEsquema.safeParse(dinero({ proyectoId: "" })), "proyectoId"), "Elige un proyecto o Sin asignar");
    assert.equal(errorDe(registrarDonacionEsquema.safeParse(dinero({ proyectoId: undefined })), "proyectoId"), "Elige un proyecto o Sin asignar");
    assert.equal(registrarDonacionEsquema.parse(dinero({ proyectoId: "sin-asignar" })).proyectoId, null);
    for (const malo of ["0", "-3", "abc", "1.5"]) assert.ok(errorDe(registrarDonacionEsquema.safeParse(dinero({ proyectoId: malo })), "proyectoId"), malo);
  });

  test("tipo faltante o desconocido", () => {
    assert.ok(errorDe(registrarDonacionEsquema.safeParse(dinero({ tipo: undefined })), "tipo"));
    assert.ok(errorDe(registrarDonacionEsquema.safeParse(dinero({ tipo: "especie" })), "tipo"));
  });

  test("fecha: inexistente, mal formada y anterior a 2020 se rechazan", () => {
    for (const mala of ["2026-02-30", "03/11/2026", "", "2019-12-31"]) {
      assert.ok(errorDe(registrarDonacionEsquema.safeParse(dinero({ fecha: mala })), "fecha"), mala);
    }
    assert.equal(registrarDonacionEsquema.safeParse(dinero({ fecha: "2020-01-01" })).success, true);
  });

  test("ids de donante y de donación vinculada", () => {
    for (const malo of ["", "abc", "0", "-1", "1.5", undefined]) assert.ok(errorDe(registrarDonacionEsquema.safeParse(dinero({ apoyanteId: malo })), "apoyanteId"), String(malo));
    assert.equal(registrarDonacionEsquema.parse(dinero({ donacionVinculadaId: "12" })).donacionVinculadaId, 12);
    assert.equal(registrarDonacionEsquema.parse(dinero({ donacionVinculadaId: "" })).donacionVinculadaId, undefined);
    assert.ok(errorDe(registrarDonacionEsquema.safeParse(dinero({ donacionVinculadaId: "x" })), "donacionVinculadaId"));
  });

  test("no lee campos de estado de la entrada", () => {
    const r = registrarDonacionEsquema.parse(dinero({ anulada: true, registradoPor: 99, id: 5 }));
    for (const k of ["anulada", "registradoPor", "id"]) assert.ok(!(k in r), k);
  });
});
