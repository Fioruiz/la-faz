import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { LectorDb } from "../lib/auth-credentials";
import { crearConsultasPrivadas } from "../lib/private-queries-core";
import { ResponsableNoActivoError, verificarResponsableActivo } from "../lib/responsable-activo";
import { responsables } from "../lib/schema";
import { crearResponsable, enTransaccion, pool } from "./helpers";

after(() => pool.end());

const baseProhibida = new Proxy({}, {
  get() {
    throw new Error("No se debía consultar la base");
  },
}) as unknown as LectorDb;

describe("verificarResponsableActivo", () => {
  test("responsable activo devuelve id y nombre", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx, { nombre: "Ana" });
      assert.deepEqual(await verificarResponsableActivo(tx, r.id), { id: r.id, nombre: "Ana" });
    }));

  test("responsable desactivado se rechaza", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx, { activo: false });
      await assert.rejects(verificarResponsableActivo(tx, r.id), ResponsableNoActivoError);
    }));

  test("id inexistente se rechaza", () =>
    enTransaccion(async (tx) => {
      await assert.rejects(verificarResponsableActivo(tx, 2_000_000_000), ResponsableNoActivoError);
    }));

  test("un id inválido se rechaza sin consultar la base", async () => {
    await assert.rejects(verificarResponsableActivo(baseProhibida, Number.NaN), ResponsableNoActivoError);
  });

  test("desactivado en medio de la sesión se rechaza en la siguiente llamada y reactivado vuelve a pasar", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      await verificarResponsableActivo(tx, r.id);
      await tx.update(responsables).set({ activo: false }).where(eq(responsables.id, r.id));
      await assert.rejects(verificarResponsableActivo(tx, r.id), ResponsableNoActivoError);
      await tx.update(responsables).set({ activo: true }).where(eq(responsables.id, r.id));
      assert.equal((await verificarResponsableActivo(tx, r.id)).id, r.id);
    }));

  test("el nombre cambiado se ve en la siguiente llamada", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx, { nombre: "Ana" });
      await tx.update(responsables).set({ nombre: "Ana María" }).where(eq(responsables.id, r.id));
      assert.equal((await verificarResponsableActivo(tx, r.id)).nombre, "Ana María");
    }));
});

describe("consultas privadas", () => {
  test("hay al menos una consulta privada registrada", () => {
    assert.ok(Object.keys(crearConsultasPrivadas(async () => ({ id: 1, nombre: "x" }), () => baseProhibida)).length >= 1);
  });

  test("cada consulta privada rechaza a un responsable desactivado y no devuelve datos", () =>
    enTransaccion(async (tx) => {
      const desactivado = await crearResponsable(tx, { activo: false });
      const consultas = crearConsultasPrivadas(() => verificarResponsableActivo(tx, desactivado.id), () => tx);
      for (const [nombre, consulta] of Object.entries(consultas)) {
        await assert.rejects((consulta as () => Promise<unknown>)(), ResponsableNoActivoError, `${nombre} no rechazó al desactivado`);
      }
    }));

  test("cada consulta privada rechaza un id inexistente", () =>
    enTransaccion(async (tx) => {
      const consultas = crearConsultasPrivadas(() => verificarResponsableActivo(tx, 2_000_000_000), () => tx);
      for (const [nombre, consulta] of Object.entries(consultas)) {
        await assert.rejects((consulta as () => Promise<unknown>)(), ResponsableNoActivoError, `${nombre} no rechazó el id inexistente`);
      }
    }));

  test("getPanel devuelve el nombre actual del responsable activo", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx, { nombre: "Ana" });
      const consultas = crearConsultasPrivadas(() => verificarResponsableActivo(tx, r.id), () => tx);
      assert.deepEqual(await consultas.getPanel(), { id: r.id, nombre: "Ana" });
    }));
});
