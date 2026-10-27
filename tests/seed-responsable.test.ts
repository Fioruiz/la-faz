import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { count, eq } from "drizzle-orm";
import { autenticarResponsable } from "../lib/auth-credentials";
import { verificarPassword } from "../lib/password";
import { apoyantes, auditLog, donaciones, itemsMeta, proyectos, responsables, voluntariosInscritos } from "../lib/schema";
import { sembrarResponsable } from "../scripts/seed-responsable";
import { enTransaccion, pool, type Tx } from "./helpers";

after(() => pool.end());

const PASSWORD = "clave-inicial-segura-1";
const entrada = (extra = {}) => ({ nombre: "Ana Pérez", correo: "inicial@prueba.test", password: PASSWORD, ...extra });
const porCorreo = (tx: Tx, correo: string) => tx.select().from(responsables).where(eq(responsables.correo, correo));

describe("responsable inicial", () => {
  test("crea un responsable activo con la contraseña como hash", () =>
    enTransaccion(async (tx) => {
      assert.deepEqual(await sembrarResponsable(tx, entrada()), { creado: true });
      const [r] = await porCorreo(tx, "inicial@prueba.test");
      assert.equal(r.nombre, "Ana Pérez");
      assert.equal(r.activo, true);
      assert.notEqual(r.passwordHash, PASSWORD);
      assert.equal(await verificarPassword(PASSWORD, r.passwordHash), true);
    }));

  test("el responsable creado puede iniciar sesión", () =>
    enTransaccion(async (tx) => {
      await sembrarResponsable(tx, entrada());
      const [r] = await porCorreo(tx, "inicial@prueba.test");
      assert.deepEqual(await autenticarResponsable(tx, { correo: "inicial@prueba.test", password: PASSWORD }), { id: r.id });
    }));

  test("dos ejecuciones no duplican al responsable", () =>
    enTransaccion(async (tx) => {
      await sembrarResponsable(tx, entrada());
      assert.deepEqual(await sembrarResponsable(tx, entrada()), { creado: false });
      assert.equal((await porCorreo(tx, "inicial@prueba.test")).length, 1);
    }));

  test("repetir con otra contraseña no cambia la guardada", () =>
    enTransaccion(async (tx) => {
      await sembrarResponsable(tx, entrada());
      const [antes] = await porCorreo(tx, "inicial@prueba.test");
      assert.deepEqual(await sembrarResponsable(tx, entrada({ password: "otra-clave-muy-larga-2" })), { creado: false });
      const [despues] = await porCorreo(tx, "inicial@prueba.test");
      assert.equal(despues.passwordHash, antes.passwordHash);
    }));

  test("repetir no reactiva ni renombra a un responsable desactivado", () =>
    enTransaccion(async (tx) => {
      await sembrarResponsable(tx, entrada());
      await tx.update(responsables).set({ activo: false }).where(eq(responsables.correo, "inicial@prueba.test"));
      await sembrarResponsable(tx, entrada({ nombre: "Otro Nombre" }));
      const [r] = await porCorreo(tx, "inicial@prueba.test");
      assert.equal(r.activo, false);
      assert.equal(r.nombre, "Ana Pérez");
    }));

  test("rechaza variables faltantes, contraseña corta y correo inválido sin escribir", () =>
    enTransaccion(async (tx) => {
      const [{ antes }] = await tx.select({ antes: count() }).from(responsables);
      await assert.rejects(sembrarResponsable(tx, entrada({ password: undefined })), /RESPONSABLE_INICIAL_PASSWORD/);
      await assert.rejects(sembrarResponsable(tx, entrada({ nombre: "" })), /RESPONSABLE_INICIAL_NOMBRE/);
      await assert.rejects(sembrarResponsable(tx, entrada({ password: "corta" })), /al menos 12 caracteres/);
      await assert.rejects(sembrarResponsable(tx, entrada({ correo: "no-es-correo" })), /RESPONSABLE_INICIAL_CORREO/);
      const [{ despues }] = await tx.select({ despues: count() }).from(responsables);
      assert.equal(despues, antes);
    }));

  test("los mensajes de error no contienen la contraseña", () =>
    enTransaccion(async (tx) => {
      await assert.rejects(sembrarResponsable(tx, entrada({ password: "corta" })), (e: Error) => !e.message.includes("corta"));
    }));

  test("no escribe en otras tablas", () =>
    enTransaccion(async (tx) => {
      const tablas = [proyectos, itemsMeta, apoyantes, donaciones, voluntariosInscritos, auditLog];
      const contar = () => Promise.all(tablas.map(async (t) => (await tx.select({ n: count() }).from(t))[0].n));
      const antes = await contar();
      await sembrarResponsable(tx, entrada());
      assert.deepEqual(await contar(), antes);
    }));
});
