import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { crearConsultasPrivadas } from "../lib/private-queries-core";
import { ResponsableNoActivoError, verificarResponsableActivo } from "../lib/responsable-activo";
import { voluntariosInscritos } from "../lib/schema";
import { crearApoyante, crearResponsable, enTransaccion, pool, type Tx } from "./helpers";

after(() => pool.end());

const consultasComo = (tx: Tx, responsableId: number) =>
  crearConsultasPrivadas(() => verificarResponsableActivo(tx, responsableId), () => tx);
const marca = () => Math.random().toString(36).slice(2, 8);
const inscribir = (tx: Tx, apoyanteId: number, extra: { mensaje?: string; creadoEn?: Date } = {}) =>
  tx.insert(voluntariosInscritos).values({ apoyanteId, consentimientoVersion: "prueba", ...extra });

describe("listarVoluntarios", () => {
  test("orden: la más reciente primero; mensaje presente o ausente; sin contacto", () =>
    enTransaccion(async (tx) => {
      const [r, m] = [await crearResponsable(tx), marca()];
      const vieja = await crearApoyante(tx, { nombre: `Vieja ${m}`, contacto: "999 888 777", esVoluntario: true });
      const nueva = await crearApoyante(tx, { nombre: `Nueva ${m}`, contacto: "nueva@correo.test", esVoluntario: true });
      await inscribir(tx, vieja.id, { creadoEn: new Date("2026-01-01T12:00:00Z") });
      await inscribir(tx, nueva.id, { mensaje: "Puedo los sábados", creadoEn: new Date("2026-02-01T12:00:00Z") });
      const { filas } = await consultasComo(tx, r.id).listarVoluntarios();
      const mias = filas.filter((f) => f.nombre.endsWith(m));
      assert.deepEqual(mias.map((f) => f.nombre), [`Nueva ${m}`, `Vieja ${m}`]);
      assert.deepEqual(mias.map((f) => f.mensaje), ["Puedo los sábados", null]);
      assert.deepEqual(mias.map((f) => f.apoyanteId), [nueva.id, vieja.id]);
      assert.ok(filas.every((f) => !("contacto" in f)));
      const json = JSON.stringify(filas);
      assert.ok(!json.includes("999 888 777") && !json.includes("nueva@correo.test"));
    }));

  test("más de 200: devuelve 200, el total real y hayMas", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const a = await crearApoyante(tx, { nombre: `Muchos ${marca()}`, esVoluntario: true });
      await tx.insert(voluntariosInscritos).values(Array.from({ length: 205 }, () => ({ apoyanteId: a.id, consentimientoVersion: "prueba" })));
      const res = await consultasComo(tx, r.id).listarVoluntarios();
      assert.equal(res.filas.length, 200);
      assert.ok(res.total >= 205 && res.hayMas);
    }));

  test("sin inscripciones propias: no falla y devuelve lista", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const res = await consultasComo(tx, r.id).listarVoluntarios();
      assert.ok(Array.isArray(res.filas));
      assert.equal(res.hayMas, res.total > res.filas.length);
    }));

  test("un responsable desactivado es rechazado", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx, { activo: false });
      await assert.rejects(() => consultasComo(tx, r.id).listarVoluntarios(), ResponsableNoActivoError);
    }));
});
