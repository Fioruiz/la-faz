import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { esFechaValida, hoyEnLima } from "../lib/fechas";

describe("hoyEnLima", () => {
  test("a las 21:00 de Lima (02:00 UTC del día siguiente) sigue siendo el día de Lima", () => {
    assert.equal(hoyEnLima(new Date("2026-11-04T02:00:00Z")), "2026-11-03");
  });

  test("a las 23:59 de Lima es el mismo día y a las 00:00 ya es el siguiente", () => {
    assert.equal(hoyEnLima(new Date("2026-11-04T04:59:00Z")), "2026-11-03");
    assert.equal(hoyEnLima(new Date("2026-11-04T05:00:00Z")), "2026-11-04");
  });

  test("a mediodía coincide con el día UTC", () => {
    assert.equal(hoyEnLima(new Date("2026-06-15T17:00:00Z")), "2026-06-15");
  });

  test("sin argumento devuelve una fecha con formato YYYY-MM-DD", () => {
    assert.match(hoyEnLima(), /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("esFechaValida", () => {
  test("acepta fechas reales, incluido el 29 de febrero bisiesto", () => {
    for (const f of ["2026-11-03", "2024-02-29", "2026-12-31"]) assert.equal(esFechaValida(f), true, f);
  });

  test("rechaza días y meses que no existen y formatos incorrectos", () => {
    for (const f of ["2026-02-30", "2026-13-01", "2026-00-10", "2026-04-31", "2025-02-29", "2026-1-5", "03/11/2026", "", "hoy"]) {
      assert.equal(esFechaValida(f), false, f);
    }
  });
});
