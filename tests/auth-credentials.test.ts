import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { eq, sql } from "drizzle-orm";
import { LoginBloqueadoError, autenticarResponsable } from "../lib/auth-credentials";
import { claveHmac, superaLimite, registrarIntento, type DbLimite } from "../lib/limite-intentos";
import { hashPassword } from "../lib/password";
import { db as dbPlena, crearResponsable, enTransaccion, pool } from "./helpers";
import { intentosLimitados } from "../lib/schema";

after(() => pool.end());

const PASSWORD = "clave-de-prueba-123";

// Una base que falla si alguien la usa: prueba que la entrada mal formada no llega a consultar.
const baseProhibida = new Proxy({}, {
  get() {
    throw new Error("No se debía consultar la base");
  },
}) as unknown as DbLimite;

async function responsableConPassword(tx: Parameters<typeof crearResponsable>[0], valores = {}) {
  return crearResponsable(tx, { passwordHash: await hashPassword(PASSWORD), ...valores });
}

describe("autenticarResponsable", () => {
  test("responsable activo con credenciales correctas", () =>
    enTransaccion(async (tx) => {
      const r = await responsableConPassword(tx);
      assert.deepEqual(await autenticarResponsable(tx, { correo: r.correo, password: PASSWORD }), { id: r.id });
    }));

  test("contraseña incorrecta", () =>
    enTransaccion(async (tx) => {
      const r = await responsableConPassword(tx);
      assert.equal(await autenticarResponsable(tx, { correo: r.correo, password: "otra-clave-123456" }), null);
    }));

  test("correo inexistente", () =>
    enTransaccion(async (tx) => {
      assert.equal(await autenticarResponsable(tx, { correo: "nadie@prueba.test", password: PASSWORD }), null);
    }));

  test("responsable desactivado con credenciales correctas", () =>
    enTransaccion(async (tx) => {
      const r = await responsableConPassword(tx, { activo: false });
      assert.equal(await autenticarResponsable(tx, { correo: r.correo, password: PASSWORD }), null);
    }));

  test("correo en mayúsculas y con espacios", () =>
    enTransaccion(async (tx) => {
      const r = await responsableConPassword(tx);
      const escrito = `  ${r.correo.toUpperCase()} `;
      assert.deepEqual(await autenticarResponsable(tx, { correo: escrito, password: PASSWORD }), { id: r.id });
    }));

  test("entrada vacía o mal formada no consulta la base", async () => {
    for (const entrada of [
      undefined,
      {},
      { correo: "", password: PASSWORD },
      { correo: "no-es-un-correo", password: PASSWORD },
      { correo: "a@prueba.test", password: "" },
      { correo: "a@prueba.test" },
    ]) {
      assert.equal(await autenticarResponsable(baseProhibida, entrada), null);
    }
  });

  test("contraseña de más de 200 caracteres no consulta la base", async () => {
    assert.equal(await autenticarResponsable(baseProhibida, { correo: "a@prueba.test", password: "x".repeat(201) }), null);
  });
});

describe("límite de intentos de login (ADR 0011)", () => {
  const fallar = async (tx: Parameters<typeof crearResponsable>[0], correo: string, veces: number) => {
    for (let i = 0; i < veces; i++) assert.equal(await autenticarResponsable(tx, { correo, password: "incorrecta-123" }), null);
  };

  test("5 fallos bloquean aunque la contraseña sea correcta", () =>
    enTransaccion(async (tx) => {
      const r = await responsableConPassword(tx);
      await fallar(tx, r.correo, 5);
      await assert.rejects(() => autenticarResponsable(tx, { correo: r.correo, password: PASSWORD }), LoginBloqueadoError);
    }));

  test("4 fallos no bloquean y el acierto limpia los fallos", () =>
    enTransaccion(async (tx) => {
      const r = await responsableConPassword(tx);
      await fallar(tx, r.correo, 4);
      assert.deepEqual(await autenticarResponsable(tx, { correo: r.correo, password: PASSWORD }), { id: r.id });
      await fallar(tx, r.correo, 4); // si no se hubieran limpiado, el quinto ya bloquearía
      assert.deepEqual(await autenticarResponsable(tx, { correo: r.correo, password: PASSWORD }), { id: r.id });
    }));

  test("un correo inexistente se bloquea igual y con el mismo error", () =>
    enTransaccion(async (tx) => {
      const correo = `nadie-${Math.random().toString(36).slice(2)}@prueba.test`;
      await fallar(tx, correo, 5);
      const error = await autenticarResponsable(tx, { correo, password: PASSWORD }).catch((e: unknown) => e);
      const r = await responsableConPassword(tx);
      await fallar(tx, r.correo, 5);
      const errorExistente = await autenticarResponsable(tx, { correo: r.correo, password: PASSWORD }).catch((e: unknown) => e);
      assert.ok(error instanceof LoginBloqueadoError && errorExistente instanceof LoginBloqueadoError);
      assert.equal((error as Error).message, (errorExistente as Error).message);
    }));

  test("un responsable desactivado también acumula fallos", () =>
    enTransaccion(async (tx) => {
      const r = await responsableConPassword(tx, { activo: false });
      for (let i = 0; i < 5; i++) assert.equal(await autenticarResponsable(tx, { correo: r.correo, password: PASSWORD }), null);
      await assert.rejects(() => autenticarResponsable(tx, { correo: r.correo, password: PASSWORD }), LoginBloqueadoError);
    }));

  test("el bloqueo termina a los 15 minutos del último fallo", () =>
    enTransaccion(async (tx) => {
      const r = await responsableConPassword(tx);
      const clave = claveHmac(r.correo);
      const hace16 = Date.now() - 16 * 60 * 1000;
      for (let i = 0; i < 5; i++) await registrarIntento(tx, "login", clave, new Date(hace16 - i * 1000));
      assert.equal(await superaLimite(tx, "login", clave), false);
      assert.deepEqual(await autenticarResponsable(tx, { correo: r.correo, password: PASSWORD }), { id: r.id });
    }));

  test("el correo se cuenta normalizado (mayúsculas y espacios)", () =>
    enTransaccion(async (tx) => {
      const r = await responsableConPassword(tx);
      for (let i = 0; i < 5; i++) await autenticarResponsable(tx, { correo: `  ${r.correo.toUpperCase()} `, password: "incorrecta-123" });
      await assert.rejects(() => autenticarResponsable(tx, { correo: r.correo, password: PASSWORD }), LoginBloqueadoError);
    }));

  test("si la base falla al contar, no hay acceso", async () => {
    const baseCaida = { select: () => { throw new Error("base caída"); }, insert: () => { throw new Error("base caída"); }, delete: () => { throw new Error("base caída"); } } as unknown as DbLimite;
    await assert.rejects(() => autenticarResponsable(baseCaida, { correo: "a@prueba.test", password: PASSWORD }), /base caída/);
  });

  test("la clave guardada no contiene el correo", () =>
    enTransaccion(async (tx) => {
      const r = await responsableConPassword(tx);
      await autenticarResponsable(tx, { correo: r.correo, password: "incorrecta-123" });
      const filas = await tx.execute(sql`select clave from intentos_limitados where clave = ${claveHmac(r.correo)}`);
      assert.equal(filas.rows.length, 1);
      assert.ok(!JSON.stringify(filas.rows).includes(r.correo));
    }));
});

describe("lib/auth.ts usa autenticarResponsable (cubre la llamada directa a /api/auth)", () => {
  test("authorize delega en autenticarResponsable y traduce el bloqueo", () => {
    const fuente = readFileSync(join(import.meta.dirname, "..", "lib", "auth.ts"), "utf8");
    assert.match(fuente, /autenticarResponsable\(getDb\(\), credentials\)/);
    assert.match(fuente, /LoginBloqueadoError/);
  });
});

describe("límite de login con peticiones en paralelo (ADR 0011)", () => {
  // Conexión real y filas confirmadas: la carrera solo existe entre conexiones distintas.
  test("20 intentos simultáneos con contraseñas distintas: como mucho 5 llegan a comprobar la contraseña", async () => {
    const correo = `paralelo-${Math.random().toString(36).slice(2)}@prueba.test`;
    try {
      const resultados = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          autenticarResponsable(dbPlena, { correo, password: `intento-${i}-incorrecto` }).then(
            () => "comprobado" as const,
            (e: unknown) => (e instanceof LoginBloqueadoError ? ("bloqueado" as const) : ("error" as const)),
          ),
        ),
      );
      assert.equal(resultados.filter((r) => r === "error").length, 0);
      assert.ok(resultados.filter((r) => r === "comprobado").length <= 5, JSON.stringify(resultados));
      assert.ok(resultados.filter((r) => r === "bloqueado").length >= 15);
    } finally {
      await dbPlena.delete(intentosLimitados).where(eq(intentosLimitados.clave, claveHmac(correo)));
    }
  });
});
