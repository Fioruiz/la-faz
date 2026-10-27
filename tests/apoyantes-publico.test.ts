import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ANONIMO, nombrePublico } from "../lib/apoyantes-publico";

describe("nombrePublico", () => {
  test("anónimo: devuelve Anónimo sin ninguna parte del nombre real", () => {
    const r = nombrePublico({ nombre: "Rosa Quispe Huamán", anonimoPublico: true });
    assert.equal(r, ANONIMO);
    assert.equal(r, "Anónimo");
    for (const parte of ["Rosa", "Quispe", "Huamán"]) assert.ok(!r.includes(parte));
  });

  test("no anónimo: devuelve el nombre", () => {
    assert.equal(nombrePublico({ nombre: "Rosa Quispe", anonimoPublico: false }), "Rosa Quispe");
  });

  test("marca ausente o nula cuenta como no anónimo", () => {
    assert.equal(nombrePublico({ nombre: "Rosa" }), "Rosa");
    assert.equal(nombrePublico({ nombre: "Rosa", anonimoPublico: null }), "Rosa");
  });
});
