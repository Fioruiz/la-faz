import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { anularDonacionEsquema, asignarDonacionEsquema, editarDonacionEsquema } from "../lib/donaciones-correcciones-esquemas";

const errorDe = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }, campo: string) =>
  r.error?.issues.find((i) => i.path[0] === campo)?.message;

describe("esquema de anular", () => {
  test("motivo válido, recortado", () => {
    assert.deepEqual(anularDonacionEsquema.parse({ donacionId: "4", motivo: "  Registrada dos veces  " }), { donacionId: 4, motivo: "Registrada dos veces" });
  });

  test("motivo vacío, solo espacios o ausente se rechaza", () => {
    for (const malo of ["", "   ", undefined]) assert.ok(errorDe(anularDonacionEsquema.safeParse({ donacionId: "4", motivo: malo }), "motivo"), String(malo));
  });

  test("motivo de 200 caracteres pasa y de 201 se rechaza", () => {
    assert.equal(anularDonacionEsquema.safeParse({ donacionId: "4", motivo: "m".repeat(200) }).success, true);
    assert.ok(errorDe(anularDonacionEsquema.safeParse({ donacionId: "4", motivo: "m".repeat(201) }), "motivo"));
  });

  test("id de la donación inválido", () => {
    for (const malo of ["", "abc", "0", "-1", "1.5", undefined]) {
      assert.ok(errorDe(anularDonacionEsquema.safeParse({ donacionId: malo, motivo: "x" }), "donacionId"), String(malo));
    }
  });
});

describe("esquema de editar", () => {
  test("solo exige un id de donación válido y deja pasar el resto", () => {
    const r = editarDonacionEsquema.parse({ donacionId: "9", monto: "10", cualquierCosa: "x" });
    assert.equal(r.donacionId, 9);
    assert.equal(r.monto, "10");
    for (const malo of ["", "abc", "0", undefined]) assert.ok(errorDe(editarDonacionEsquema.safeParse({ donacionId: malo }), "donacionId"), String(malo));
  });
});

describe("esquema de asignar", () => {
  test("proyecto e ítem: sin-asignar da null, id numérico, ítem opcional", () => {
    assert.deepEqual(asignarDonacionEsquema.parse({ donacionId: "9", proyectoId: "7", itemId: "3" }), { donacionId: 9, proyectoId: 7, itemId: 3, confirmarDuplicado: false });
    assert.equal(asignarDonacionEsquema.parse({ donacionId: "9", proyectoId: "sin-asignar" }).proyectoId, null);
    assert.equal(asignarDonacionEsquema.parse({ donacionId: "9", proyectoId: "7", itemId: "" }).itemId, undefined);
  });

  test("proyecto vacío o inválido, donación inválida y solo esos campos pasan", () => {
    assert.equal(errorDe(asignarDonacionEsquema.safeParse({ donacionId: "9", proyectoId: "" }), "proyectoId"), "Elige un proyecto o Sin asignar");
    assert.ok(errorDe(asignarDonacionEsquema.safeParse({ donacionId: "9", proyectoId: "abc" }), "proyectoId"));
    assert.ok(errorDe(asignarDonacionEsquema.safeParse({ donacionId: "x", proyectoId: "7" }), "donacionId"));
    const r = asignarDonacionEsquema.parse({ donacionId: "9", proyectoId: "7", monto: "99", tipo: "dinero", apoyanteId: "5" });
    assert.equal(r.donacionId, 9);
    assert.equal(r.proyectoId, 7);
    assert.ok(!("monto" in r) && !("tipo" in r) && !("apoyanteId" in r));
  });
});
