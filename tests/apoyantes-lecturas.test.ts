import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { crearConsultasPrivadas } from "../lib/private-queries-core";
import { ResponsableNoActivoError, verificarResponsableActivo } from "../lib/responsable-activo";
import { apoyantes, donaciones, voluntariosInscritos } from "../lib/schema";
import { crearApoyante, crearResponsable, enTransaccion, pool, type Tx } from "./helpers";

after(() => pool.end());

const consultasComo = (tx: Tx, responsableId: number) =>
  crearConsultasPrivadas(() => verificarResponsableActivo(tx, responsableId), () => tx);

// La base de pruebas puede traer filas de otras pruebas: se busca por un sufijo propio.
const marca = () => Math.random().toString(36).slice(2, 8);

describe("lecturas privadas de apoyantes", () => {
  test("la búsqueda ignora mayúsculas y tildes", () =>
    enTransaccion(async (tx) => {
      const [r, m] = [await crearResponsable(tx), marca()];
      await crearApoyante(tx, { nombre: `Ana Pérez ${m}` });
      const { filas } = await consultasComo(tx, r.id).listarApoyantes({ busqueda: `PEREZ ${m}` });
      assert.deepEqual(filas.map((f) => f.nombre), [`Ana Pérez ${m}`]);
    }));

  test("%, _ y comillas se buscan como texto literal", () =>
    enTransaccion(async (tx) => {
      const [r, m] = [await crearResponsable(tx), marca()];
      await crearApoyante(tx, { nombre: `100% Solidario ${m}` });
      await crearApoyante(tx, { nombre: `Otro ${m}` });
      const c = consultasComo(tx, r.id);
      assert.equal((await c.listarApoyantes({ busqueda: `100% solidario ${m}` })).filas.length, 1);
      assert.equal((await c.listarApoyantes({ busqueda: `%` })).filas.every((f) => f.nombre.includes("%")), true);
      assert.equal((await c.listarApoyantes({ busqueda: `_` })).filas.every((f) => f.nombre.includes("_")), true);
      assert.deepEqual((await c.listarApoyantes({ busqueda: `'; drop table apoyantes; --` })).filas, []);
    }));

  test("el filtro de voluntarios incluye a quienes también son donantes", () =>
    enTransaccion(async (tx) => {
      const [r, m] = [await crearResponsable(tx), marca()];
      await crearApoyante(tx, { nombre: `Solo donante ${m}`, esDonante: true });
      await crearApoyante(tx, { nombre: `Solo voluntario ${m}`, esDonante: false, esVoluntario: true });
      await crearApoyante(tx, { nombre: `Ambos ${m}`, esDonante: true, esVoluntario: true });
      const c = consultasComo(tx, r.id);
      const voluntarios = (await c.listarApoyantes({ busqueda: m, rol: "voluntario" })).filas.map((f) => f.nombre).sort();
      assert.deepEqual(voluntarios, [`Ambos ${m}`, `Solo voluntario ${m}`]);
      const donantes = (await c.listarApoyantes({ busqueda: m, rol: "donante" })).filas.map((f) => f.nombre).sort();
      assert.deepEqual(donantes, [`Ambos ${m}`, `Solo donante ${m}`]);
      assert.equal((await c.listarApoyantes({ busqueda: m, rol: "otra-cosa" })).filas.length, 3);
    }));

  test("la lista está ordenada por nombre y no incluye el contacto", () =>
    enTransaccion(async (tx) => {
      const [r, m] = [await crearResponsable(tx), marca()];
      await crearApoyante(tx, { nombre: `Zoila ${m}`, contacto: "999 888 777" });
      await crearApoyante(tx, { nombre: `Álvaro ${m}`, contacto: "alvaro@correo.test" });
      const { filas } = await consultasComo(tx, r.id).listarApoyantes({ busqueda: m });
      assert.deepEqual(filas.map((f) => f.nombre), [`Álvaro ${m}`, `Zoila ${m}`]);
      assert.ok(!JSON.stringify(filas).includes("999 888 777"));
      assert.ok(!JSON.stringify(filas).includes("alvaro@correo.test"));
      assert.ok(filas.every((f) => !("contacto" in f)));
    }));

  test("muestra las primeras 200 y avisa que hay más", () =>
    enTransaccion(async (tx) => {
      const [r, m] = [await crearResponsable(tx), marca()];
      await tx.insert(apoyantes).values(Array.from({ length: 201 }, (_, i) => ({ nombre: `Masivo ${m} ${String(i).padStart(3, "0")}`, esDonante: true })));
      const c = consultasComo(tx, r.id);
      const resultado = await c.listarApoyantes({ busqueda: `masivo ${m}` });
      assert.deepEqual([resultado.filas.length, resultado.total, resultado.hayMas], [200, 201, true]);
      const acotado = await c.listarApoyantes({ busqueda: `masivo ${m} 000` });
      assert.deepEqual([acotado.filas.length, acotado.hayMas], [1, false]);
    }));

  test("getApoyante devuelve el contacto y las cantidades de registros", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const a = await crearApoyante(tx, { nombre: "Con registros", contacto: "999 888 777", esVoluntario: true });
      await tx.insert(donaciones).values({ apoyanteId: a.id, tipo: "dinero", monto: "10", fecha: "2026-11-01", registradoPor: r.id });
      await tx.insert(voluntariosInscritos).values([{ apoyanteId: a.id, consentimientoVersion: "prueba" }, { apoyanteId: a.id, consentimientoVersion: "prueba" }]);
      const leido = await consultasComo(tx, r.id).getApoyante(a.id);
      assert.deepEqual(
        [leido?.nombre, leido?.contacto, leido?.cantidadDonaciones, leido?.cantidadInscripciones],
        ["Con registros", "999 888 777", 1, 2],
      );
    }));

  test("un id inexistente o inválido devuelve null", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const c = consultasComo(tx, r.id);
      for (const id of [2_000_000_000, 0, -1, 1.5, Number.NaN, 3_000_000_000]) assert.equal(await c.getApoyante(id), null, String(id));
    }));

  test("las consultas rechazan a un responsable desactivado sin devolver datos", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx, { activo: false });
      const a = await crearApoyante(tx);
      const c = consultasComo(tx, r.id);
      await assert.rejects(c.listarApoyantes(), ResponsableNoActivoError);
      await assert.rejects(c.getApoyante(a.id), ResponsableNoActivoError);
    }));
});
