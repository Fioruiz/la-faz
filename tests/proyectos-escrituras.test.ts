import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import {
  ejecutarEscrituraAuditada,
  type DbTransaccional,
  type EscrituraAuditada,
} from "../lib/escritura-auditada-core";
import { crearItem, crearProyecto, editarItem, editarProyecto, finalizarProyecto } from "../lib/proyectos-escrituras";
import { verificarResponsableActivo } from "../lib/responsable-activo";
import { auditLog, donaciones, itemsMeta, proyectos } from "../lib/schema";
import { crearApoyante, crearItem as crearItemFila, crearProyecto as crearProyectoFila, crearResponsable, enTransaccion, pool, type Tx } from "./helpers";

after(() => pool.end());

function ejecutar<TEsquema extends z.ZodType, TDatos>(
  tx: Tx,
  responsableId: number,
  escritura: { esquema: TEsquema; escribir: EscrituraAuditada<TEsquema, TDatos>["escribir"] },
  entrada: Record<string, unknown>,
) {
  return ejecutarEscrituraAuditada({
    nombre: "prueba",
    db: tx as unknown as DbTransaccional,
    requerir: () => verificarResponsableActivo(tx, responsableId),
    entrada,
    esquema: escritura.esquema,
    escribir: escritura.escribir,
  });
}

const sufijo = () => Math.random().toString(36).slice(2, 8);
const regla = (mensaje: string) => ({ ok: false, tipo: "regla", mensaje });
const proyectoPorId = async (tx: Tx, id: number) => (await tx.select().from(proyectos).where(eq(proyectos.id, id)))[0];
const historial = (tx: Tx, entidad: string, id: number) =>
  tx.select().from(auditLog).where(and(eq(auditLog.entidad, entidad), eq(auditLog.entidadId, id)));

describe("crear proyecto", () => {
  test("con meta: queda activo y deja historial de creación atribuido al responsable", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const res = await ejecutar(tx, r.id, crearProyecto, { nombre: `Navidad ${sufijo()}`, descripcion: "Packs", tieneMeta: "on" });
      assert.ok(res.ok);
      const p = await proyectoPorId(tx, res.datos.id);
      assert.deepEqual([p.estado, p.tieneMeta, p.resultado], ["activo", true, null]);
      const [h] = await historial(tx, "proyecto", p.id);
      assert.equal(h.accion, "crear");
      assert.equal(h.antes, null);
      assert.deepEqual(h.despues, { nombre: p.nombre, descripcion: "Packs", tieneMeta: true, estado: "activo" });
      assert.equal(h.responsableId, r.id);
    }));

  test("informativo: sin la casilla queda sin meta y sin descripción", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const res = await ejecutar(tx, r.id, crearProyecto, { nombre: `Coro ${sufijo()}` });
      assert.ok(res.ok);
      const p = await proyectoPorId(tx, res.datos.id);
      assert.deepEqual([p.tieneMeta, p.descripcion], [false, null]);
    }));

  test("datos inválidos: no se crea ni deja historial y conserva lo escrito", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const res = await ejecutar(tx, r.id, crearProyecto, { nombre: "", descripcion: "conservar" });
      assert.ok(!res.ok && res.tipo === "validacion");
      assert.equal(res.valores.descripcion, "conservar");
      assert.equal((await tx.select().from(auditLog)).length, 0);
    }));

  test("nombre repetido con otra capitalización y con espacios", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const n = sufijo();
      await crearProyectoFila(tx, { nombre: `Música ${n}` });
      for (const nombre of [`música ${n}`, `  MÚSICA ${n}  `]) {
        assert.deepEqual(await ejecutar(tx, r.id, crearProyecto, { nombre }), regla("Ya existe un proyecto con ese nombre"));
      }
      assert.equal((await tx.select().from(auditLog)).length, 0);
    }));
});

describe("editar proyecto", () => {
  test("con cambios: actualiza y guarda antes y después", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyectoFila(tx, { descripcion: "vieja" })];
      const res = await ejecutar(tx, r.id, editarProyecto, { proyectoId: p.id, nombre: p.nombre, descripcion: "nueva" });
      assert.ok(res.ok);
      assert.equal((await proyectoPorId(tx, p.id)).descripcion, "nueva");
      const [h] = await historial(tx, "proyecto", p.id);
      assert.equal(h.accion, "editar");
      assert.deepEqual(h.antes, { nombre: p.nombre, descripcion: "vieja", tieneMeta: false });
      assert.deepEqual(h.despues, { nombre: p.nombre, descripcion: "nueva", tieneMeta: false });
    }));

  test("sin cambios: no escribe nada", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyectoFila(tx, { descripcion: "igual" })];
      const res = await ejecutar(tx, r.id, editarProyecto, { proyectoId: p.id, nombre: ` ${p.nombre} `, descripcion: "igual" });
      assert.deepEqual(res, regla("No hay cambios para guardar"));
      assert.equal((await historial(tx, "proyecto", p.id)).length, 0);
    }));

  test("renombrar con el nombre de otro proyecto", () =>
    enTransaccion(async (tx) => {
      const n = sufijo();
      const [r, a] = [await crearResponsable(tx), await crearProyectoFila(tx, { nombre: `Alfa ${n}` })];
      const b = await crearProyectoFila(tx, { nombre: `Beta ${n}` });
      const res = await ejecutar(tx, r.id, editarProyecto, { proyectoId: b.id, nombre: `alfa ${n}` });
      assert.deepEqual(res, regla("Ya existe un proyecto con ese nombre"));
      assert.equal((await proyectoPorId(tx, b.id)).nombre, `Beta ${n}`);
      assert.ok(a);
    }));

  test("cambiar solo la capitalización de su propio nombre se permite", () =>
    enTransaccion(async (tx) => {
      const n = sufijo();
      const [r, p] = [await crearResponsable(tx), await crearProyectoFila(tx, { nombre: `música ${n}` })];
      const res = await ejecutar(tx, r.id, editarProyecto, { proyectoId: p.id, nombre: `Música ${n}` });
      assert.ok(res.ok);
    }));

  test("quitar la meta a un proyecto con ítems", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyectoFila(tx, { tieneMeta: true })];
      await crearItemFila(tx, p.id);
      const res = await ejecutar(tx, r.id, editarProyecto, { proyectoId: p.id, nombre: p.nombre });
      assert.deepEqual(res, regla("Un proyecto con ítems no puede quedar sin meta"));
      assert.equal((await proyectoPorId(tx, p.id)).tieneMeta, true);
    }));

  test("quitar la meta sin ítems y ponerla de nuevo", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyectoFila(tx, { tieneMeta: true })];
      assert.ok((await ejecutar(tx, r.id, editarProyecto, { proyectoId: p.id, nombre: p.nombre })).ok);
      assert.ok((await ejecutar(tx, r.id, editarProyecto, { proyectoId: p.id, nombre: p.nombre, tieneMeta: "on" })).ok);
    }));

  test("proyecto inexistente", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const res = await ejecutar(tx, r.id, editarProyecto, { proyectoId: 2_000_000_000, nombre: "X" });
      assert.deepEqual(res, regla("No se encontró el proyecto"));
    }));

  test("un proyecto finalizado no se edita", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyectoFila(tx, { estado: "finalizado", resultado: "ok" })];
      const res = await ejecutar(tx, r.id, editarProyecto, { proyectoId: p.id, nombre: "Otro nombre" });
      assert.deepEqual(res, regla("Este proyecto ya está finalizado"));
      assert.equal((await proyectoPorId(tx, p.id)).nombre, p.nombre);
    }));
});

describe("finalizar proyecto", () => {
  test("con resultado: queda finalizado y el historial guarda estado anterior y nuevo", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyectoFila(tx)];
      const res = await ejecutar(tx, r.id, finalizarProyecto, { proyectoId: p.id, resultado: "Se entregaron 1850 packs" });
      assert.ok(res.ok);
      const despues = await proyectoPorId(tx, p.id);
      assert.deepEqual([despues.estado, despues.resultado], ["finalizado", "Se entregaron 1850 packs"]);
      const [h] = await historial(tx, "proyecto", p.id);
      assert.equal(h.accion, "finalizar");
      assert.deepEqual(h.antes, { estado: "activo", resultado: null });
      assert.deepEqual(h.despues, { estado: "finalizado", resultado: "Se entregaron 1850 packs" });
    }));

  test("resultado vacío: sigue activo y no deja historial", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyectoFila(tx)];
      const res = await ejecutar(tx, r.id, finalizarProyecto, { proyectoId: p.id, resultado: "   " });
      assert.ok(!res.ok && res.tipo === "validacion");
      assert.equal((await proyectoPorId(tx, p.id)).estado, "activo");
      assert.equal((await historial(tx, "proyecto", p.id)).length, 0);
    }));

  test("finalizar dos veces", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyectoFila(tx)];
      await ejecutar(tx, r.id, finalizarProyecto, { proyectoId: p.id, resultado: "Primero" });
      const res = await ejecutar(tx, r.id, finalizarProyecto, { proyectoId: p.id, resultado: "Segundo" });
      assert.deepEqual(res, regla("Este proyecto ya está finalizado"));
      assert.equal((await proyectoPorId(tx, p.id)).resultado, "Primero");
    }));

  test("con metas sin cumplir se permite", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyectoFila(tx, { tieneMeta: true })];
      await crearItemFila(tx, p.id, { cantidadMeta: 2000 });
      assert.ok((await ejecutar(tx, r.id, finalizarProyecto, { proyectoId: p.id, resultado: "Parcial" })).ok);
    }));

  test("responsable desactivado: no escribe", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx, { activo: false }), await crearProyectoFila(tx)];
      const res = await ejecutar(tx, r.id, finalizarProyecto, { proyectoId: p.id, resultado: "x" });
      assert.deepEqual(res, { ok: false, tipo: "no_autorizado" });
      assert.equal((await proyectoPorId(tx, p.id)).estado, "activo");
    }));
});

const itemEntrada = (proyectoId: number, extra: Record<string, unknown> = {}) => ({
  proyectoId,
  nombre: "Pack de útiles",
  unidad: "pack",
  cantidadMeta: "2000",
  ...extra,
});
const itemPorId = async (tx: Tx, id: number) => (await tx.select().from(itemsMeta).where(eq(itemsMeta.id, id)))[0];

describe("crear ítem", () => {
  test("válido sin costo: queda asociado al proyecto con historial", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyectoFila(tx, { tieneMeta: true })];
      const res = await ejecutar(tx, r.id, crearItem, itemEntrada(p.id));
      assert.ok(res.ok);
      const i = await itemPorId(tx, res.datos.id);
      assert.deepEqual([i.proyectoId, i.nombre, i.unidad, i.cantidadMeta, i.costoReferencial], [p.id, "Pack de útiles", "pack", 2000, null]);
      const [h] = await historial(tx, "item_meta", i.id);
      assert.equal(h.accion, "crear");
      assert.equal(h.antes, null);
      assert.deepEqual(h.despues, { proyectoId: p.id, nombre: "Pack de útiles", unidad: "pack", cantidadMeta: 2000, costoReferencial: null });
      assert.equal(h.responsableId, r.id);
    }));

  test("con costo con coma: guarda 13.50; vacío no guarda cero", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyectoFila(tx, { tieneMeta: true })];
      const a = await ejecutar(tx, r.id, crearItem, itemEntrada(p.id, { nombre: "A", costoReferencial: "13,50" }));
      const b = await ejecutar(tx, r.id, crearItem, itemEntrada(p.id, { nombre: "B", costoReferencial: "" }));
      assert.ok(a.ok && b.ok);
      assert.equal((await itemPorId(tx, a.datos.id)).costoReferencial, "13.50");
      assert.equal((await itemPorId(tx, b.datos.id)).costoReferencial, null);
    }));

  test("campos inválidos: no crea ni deja historial", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyectoFila(tx, { tieneMeta: true })];
      const res = await ejecutar(tx, r.id, crearItem, itemEntrada(p.id, { cantidadMeta: "0", costoReferencial: "13.505" }));
      assert.ok(!res.ok && res.tipo === "validacion");
      assert.ok(res.errores.cantidadMeta && res.errores.costoReferencial);
      assert.equal(res.valores.nombre, "Pack de útiles");
      assert.equal((await tx.select().from(itemsMeta).where(eq(itemsMeta.proyectoId, p.id))).length, 0);
    }));

  test("nombre repetido en el mismo proyecto (otra capitalización) y permitido en otro", () =>
    enTransaccion(async (tx) => {
      const [r, p, q] = [await crearResponsable(tx), await crearProyectoFila(tx, { tieneMeta: true }), await crearProyectoFila(tx, { tieneMeta: true })];
      assert.ok((await ejecutar(tx, r.id, crearItem, itemEntrada(p.id, { nombre: "Agua" }))).ok);
      const repetido = await ejecutar(tx, r.id, crearItem, itemEntrada(p.id, { nombre: " AGUA " }));
      assert.deepEqual(repetido, regla("Ya existe un ítem con ese nombre en este proyecto"));
      assert.ok((await ejecutar(tx, r.id, crearItem, itemEntrada(q.id, { nombre: "Agua" }))).ok);
    }));

  test("proyecto sin meta, finalizado e inexistente", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const sinMeta = await crearProyectoFila(tx);
      const finalizado = await crearProyectoFila(tx, { tieneMeta: true, estado: "finalizado", resultado: "x" });
      assert.deepEqual(await ejecutar(tx, r.id, crearItem, itemEntrada(sinMeta.id)), regla("Este proyecto no tiene meta"));
      assert.deepEqual(await ejecutar(tx, r.id, crearItem, itemEntrada(finalizado.id)), regla("Este proyecto ya está finalizado"));
      assert.deepEqual(await ejecutar(tx, r.id, crearItem, itemEntrada(2_000_000_000)), regla("No se encontró el proyecto"));
      assert.equal((await tx.select().from(auditLog)).length, 0);
    }));
});

describe("editar ítem", () => {
  const editar = (p: { id: number }, i: { id: number }, extra: Record<string, unknown>) =>
    ({ ...itemEntrada(p.id, { nombre: "Pack", unidad: "pack", cantidadMeta: "2000" }), itemId: i.id, ...extra });

  test("cambiar la meta: guarda 2000 y 2500 en el historial", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyectoFila(tx, { tieneMeta: true })];
      const i = await crearItemFila(tx, p.id, { nombre: "Pack", unidad: "pack", cantidadMeta: 2000 });
      const res = await ejecutar(tx, r.id, editarItem, editar(p, i, { cantidadMeta: "2500" }));
      assert.ok(res.ok);
      assert.equal((await itemPorId(tx, i.id)).cantidadMeta, 2500);
      const [h] = await historial(tx, "item_meta", i.id);
      assert.equal(h.accion, "editar");
      assert.equal((h.antes as { cantidadMeta: number }).cantidadMeta, 2000);
      assert.equal((h.despues as { cantidadMeta: number }).cantidadMeta, 2500);
      assert.equal(h.responsableId, r.id);
    }));

  test("quitar el costo lo deja en null y queda en el historial", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyectoFila(tx, { tieneMeta: true })];
      const i = await crearItemFila(tx, p.id, { nombre: "Pack", unidad: "pack", cantidadMeta: 2000, costoReferencial: "13.00" });
      assert.ok((await ejecutar(tx, r.id, editarItem, editar(p, i, { costoReferencial: "" }))).ok);
      assert.equal((await itemPorId(tx, i.id)).costoReferencial, null);
      const [h] = await historial(tx, "item_meta", i.id);
      assert.equal((h.antes as { costoReferencial: string }).costoReferencial, "13.00");
      assert.equal((h.despues as { costoReferencial: null }).costoReferencial, null);
    }));

  test("bajar la meta por debajo de lo recibido se permite", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyectoFila(tx, { tieneMeta: true })];
      const i = await crearItemFila(tx, p.id, { nombre: "Pack", unidad: "pack", cantidadMeta: 2000 });
      const a = await crearApoyante(tx);
      await tx.insert(donaciones).values({ apoyanteId: a.id, proyectoId: p.id, itemId: i.id, tipo: "producto", cantidad: 500, fecha: "2026-11-01", registradoPor: r.id });
      assert.ok((await ejecutar(tx, r.id, editarItem, editar(p, i, { cantidadMeta: "100" }))).ok);
      assert.equal((await itemPorId(tx, i.id)).cantidadMeta, 100);
    }));

  test("sin cambios: no escribe nada", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyectoFila(tx, { tieneMeta: true })];
      const i = await crearItemFila(tx, p.id, { nombre: "Pack", unidad: "pack", cantidadMeta: 2000 });
      assert.deepEqual(await ejecutar(tx, r.id, editarItem, editar(p, i, {})), regla("No hay cambios para guardar"));
      assert.equal((await historial(tx, "item_meta", i.id)).length, 0);
    }));

  test("renombrar con el nombre de otro ítem del proyecto", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyectoFila(tx, { tieneMeta: true })];
      await crearItemFila(tx, p.id, { nombre: "Agua" });
      const i = await crearItemFila(tx, p.id, { nombre: "Pack", unidad: "pack", cantidadMeta: 2000 });
      const res = await ejecutar(tx, r.id, editarItem, editar(p, i, { nombre: "agua" }));
      assert.deepEqual(res, regla("Ya existe un ítem con ese nombre en este proyecto"));
    }));

  test("un ítem con el id de un proyecto al que no pertenece", () =>
    enTransaccion(async (tx) => {
      const [r, p, otro] = [await crearResponsable(tx), await crearProyectoFila(tx, { tieneMeta: true }), await crearProyectoFila(tx, { tieneMeta: true })];
      const i = await crearItemFila(tx, p.id, { nombre: "Pack", unidad: "pack", cantidadMeta: 2000 });
      const res = await ejecutar(tx, r.id, editarItem, editar(otro, i, { cantidadMeta: "5" }));
      assert.deepEqual(res, regla("No se encontró el ítem en este proyecto"));
      assert.equal((await itemPorId(tx, i.id)).cantidadMeta, 2000);
    }));

  test("proyecto finalizado: no cambia nada", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyectoFila(tx, { tieneMeta: true, estado: "finalizado", resultado: "x" })];
      const i = await crearItemFila(tx, p.id, { nombre: "Pack", unidad: "pack", cantidadMeta: 2000 });
      assert.deepEqual(await ejecutar(tx, r.id, editarItem, editar(p, i, { cantidadMeta: "5" })), regla("Este proyecto ya está finalizado"));
      assert.equal((await itemPorId(tx, i.id)).cantidadMeta, 2000);
    }));
});
