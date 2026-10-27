import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CONSENTIMIENTO_VOLUNTARIADO } from "../lib/sitio-contenido";
import { inscripcionVoluntarioEsquema as esquema } from "../lib/voluntariado-esquemas";

const base = (extra: Record<string, unknown> = {}) => ({ nombre: "Rosa Quispe", contacto: "999 888 777", consentimiento: "on", ...extra });
const errorDe = (r: { error?: { issues: { path: PropertyKey[]; message: string }[] } }, campo: string) =>
  r.error?.issues.find((i) => i.path[0] === campo)?.message;

describe("esquema de inscripción de voluntario", () => {
  test("válido: recorta y el mensaje vacío queda null", () => {
    const r = esquema.parse(base({ nombre: "  Rosa Quispe  ", mensaje: "   " }));
    assert.deepEqual(r, { nombre: "Rosa Quispe", contacto: "999 888 777", mensaje: null, consentimiento: true });
  });

  test("nombre vacío, de 101 caracteres; 100 pasa", () => {
    assert.ok(errorDe(esquema.safeParse(base({ nombre: "  " })), "nombre"));
    assert.ok(errorDe(esquema.safeParse(base({ nombre: "n".repeat(101) })), "nombre"));
    assert.equal(esquema.safeParse(base({ nombre: "n".repeat(100) })).success, true);
  });

  test("contacto obligatorio; 201 falla y 200 pasa", () => {
    assert.ok(errorDe(esquema.safeParse(base({ contacto: "" })), "contacto"));
    assert.ok(errorDe(esquema.safeParse({ nombre: "X", consentimiento: "on" }), "contacto"));
    assert.ok(errorDe(esquema.safeParse(base({ contacto: "c".repeat(201) })), "contacto"));
    assert.equal(esquema.safeParse(base({ contacto: "c".repeat(200) })).success, true);
  });

  test("mensaje: 501 falla y 500 pasa", () => {
    assert.ok(errorDe(esquema.safeParse(base({ mensaje: "m".repeat(501) })), "mensaje"));
    assert.equal(esquema.safeParse(base({ mensaje: "m".repeat(500) })).success, true);
  });

  test("consentimiento: sin marcar falla; \"on\" y true pasan", () => {
    assert.ok(errorDe(esquema.safeParse(base({ consentimiento: undefined })), "consentimiento"));
    assert.ok(errorDe(esquema.safeParse(base({ consentimiento: "no" })), "consentimiento"));
    assert.equal(esquema.safeParse(base({ consentimiento: true })).success, true);
    assert.equal(esquema.safeParse(base({ consentimiento: "on" })).success, true);
  });

  test("ignora campos de más (como una versión de consentimiento enviada por el cliente)", () => {
    const r = esquema.parse(base({ consentimientoVersion: "hackeada" }));
    assert.deepEqual(Object.keys(r).sort(), ["consentimiento", "contacto", "mensaje", "nombre"]);
  });
});

describe("texto de consentimiento", () => {
  test("tiene versión, texto y aviso de provisional", () => {
    assert.ok(CONSENTIMIENTO_VOLUNTARIADO.version.length > 0);
    assert.ok(CONSENTIMIENTO_VOLUNTARIADO.texto.length > 0);
    assert.match(CONSENTIMIENTO_VOLUNTARIADO.aviso, /provisional/i);
  });
});
