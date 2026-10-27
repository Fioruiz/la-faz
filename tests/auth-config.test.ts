import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { SESION_MAX_AGE_SEGUNDOS, jwtCallback, sessionCallback } from "../lib/auth-config";

describe("configuración de la sesión", () => {
  test("el token tiene solo el id aunque el usuario traiga más datos", () => {
    const token = jwtCallback({
      token: { name: "Ana", email: "ana@prueba.test", picture: "x" },
      user: { id: "7", name: "Ana", email: "ana@prueba.test", passwordHash: "hash", activo: true } as { id: string },
    });
    assert.deepEqual(token, { sub: "7" });
  });

  test("en peticiones posteriores el token conserva solo el id", () => {
    assert.deepEqual(jwtCallback({ token: { sub: "7", email: "ana@prueba.test", activo: true } }), { sub: "7" });
  });

  test("la sesión expone el id y nada más", () => {
    const session = sessionCallback({
      session: { expires: "2099-01-01T00:00:00.000Z", user: { name: "Ana", email: "ana@prueba.test" } } as never,
      token: { sub: "7", email: "ana@prueba.test" },
    });
    assert.deepEqual(session, { expires: "2099-01-01T00:00:00.000Z", user: { id: "7" } });
  });

  test("la sesión caduca a los 7 días", () => {
    assert.equal(SESION_MAX_AGE_SEGUNDOS, 7 * 24 * 60 * 60);
  });
});
