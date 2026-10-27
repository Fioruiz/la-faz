import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { elegirDestino, validarPassword } from "../scripts/crear-rol-publico";

const real = "postgresql://u:p@ep-real-pooler.us-east-2.aws.neon.tech/db";
const realDirecta = "postgresql://u:p@ep-real.us-east-2.aws.neon.tech/db";
const prueba = "postgresql://u:p@ep-prueba.us-east-2.aws.neon.tech/db";
const o = { prueba: false, confirmarProduccion: false, rotar: false };

describe("scripts/crear-rol-publico: guardias", () => {
  test("sin flags no escribe en la base real", () => {
    assert.throws(() => elegirDestino({ DATABASE_URL_UNPOOLED: realDirecta }, o), /base REAL/);
  });

  test("--confirmar-produccion usa la conexión directa", () => {
    assert.equal(elegirDestino({ DATABASE_URL_UNPOOLED: realDirecta }, { ...o, confirmarProduccion: true }), realDirecta);
  });

  test("--prueba usa DATABASE_URL_TEST", () => {
    assert.equal(elegirDestino({ DATABASE_URL_TEST: prueba, DATABASE_URL: real, DATABASE_URL_UNPOOLED: realDirecta }, { ...o, prueba: true }), prueba);
  });

  test("--prueba se niega si DATABASE_URL_TEST es la base real (con o sin pooler)", () => {
    assert.throws(() => elegirDestino({ DATABASE_URL_TEST: real, DATABASE_URL: real }, { ...o, prueba: true }), /mismo endpoint/);
    assert.throws(() => elegirDestino({ DATABASE_URL_TEST: realDirecta, DATABASE_URL: real }, { ...o, prueba: true }), /mismo endpoint/);
    assert.throws(() => elegirDestino({ DATABASE_URL_TEST: real, DATABASE_URL_UNPOOLED: realDirecta }, { ...o, prueba: true }), /mismo endpoint/);
  });

  test("la contraseña exige 24 caracteres y nunca aparece en el mensaje de error", () => {
    assert.throws(() => validarPassword(undefined), /PUBLICO_LECTURA_PASSWORD/);
    assert.throws(() => validarPassword("corta-secreta"), (e: Error) => /24 caracteres/.test(e.message) && !e.message.includes("corta-secreta"));
    assert.equal(validarPassword("x".repeat(24)), "x".repeat(24));
  });

  test("el script aplica los permisos en una transacción", () => {
    const fuente = readFileSync(join(import.meta.dirname, "..", "scripts", "crear-rol-publico.ts"), "utf8");
    assert.match(fuente, /query\("begin"\)/);
    assert.match(fuente, /query\("commit"\)/);
    assert.match(fuente, /query\("rollback"\)/);
  });
});

describe("el mensaje de bloqueo de login llega al formulario", () => {
  test("auth.ts lanza un error con código \"bloqueado\" y la acción lo traduce", () => {
    const raiz = join(import.meta.dirname, "..");
    assert.match(readFileSync(join(raiz, "lib", "auth.ts"), "utf8"), /code = "bloqueado"/);
    assert.match(readFileSync(join(raiz, "app", "login", "actions.ts"), "utf8"), /code === "bloqueado"\) return \{ error: DEMASIADOS_INTENTOS \}/);
  });
});
