import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { compararConHashFicticio, hashPassword, verificarPassword } from "../lib/password";

describe("hash de contraseñas", () => {
  test("el hash no es el texto original", async () => {
    const hash = await hashPassword("una-clave-larga-123");
    assert.notEqual(hash, "una-clave-larga-123");
    assert.match(hash, /^\$2[aby]\$12\$/);
  });

  test("verifica la contraseña correcta", async () => {
    const hash = await hashPassword("una-clave-larga-123");
    assert.equal(await verificarPassword("una-clave-larga-123", hash), true);
  });

  test("rechaza una contraseña incorrecta", async () => {
    const hash = await hashPassword("una-clave-larga-123");
    assert.equal(await verificarPassword("otra-clave-larga-123", hash), false);
  });

  test("la misma contraseña produce hashes distintos", async () => {
    const [a, b] = await Promise.all([hashPassword("una-clave-larga-123"), hashPassword("una-clave-larga-123")]);
    assert.notEqual(a, b);
  });

  test("el hash ficticio nunca acepta una contraseña", async () => {
    assert.equal(await compararConHashFicticio("no-es-una-contraseña-real"), false);
  });
});
