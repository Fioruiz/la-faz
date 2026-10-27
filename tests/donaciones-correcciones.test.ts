import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { anularDonacion, asignarDonacion, crearEditarDonacion, editarDonacion } from "../lib/donaciones-correcciones";
import { registrarDonacion } from "../lib/donaciones-escrituras";
import {
  ejecutarEscrituraAuditada,
  type DbTransaccional,
  type EscrituraAuditada,
} from "../lib/escritura-auditada-core";
import { hoyEnLima } from "../lib/fechas";
import { verificarResponsableActivo } from "../lib/responsable-activo";
import { auditLog, donaciones } from "../lib/schema";
import { crearApoyante, crearItem, crearProyecto, crearResponsable, enTransaccion, pool, type Tx } from "./helpers";

after(() => pool.end());

function ejecutar<TEsquema extends z.ZodType, TDatos>(
  tx: Tx,
  responsableId: number,
  escritura: { esquema: TEsquema; escribir: EscrituraAuditada<TEsquema, TDatos>["escribir"] },
  entrada: Record<string, unknown>,
) {
  return ejecutarEscrituraAuditada({
    nombre: "prueba-correcciones",
    db: tx as unknown as DbTransaccional,
    requerir: () => verificarResponsableActivo(tx, responsableId),
    entrada,
    esquema: escritura.esquema,
    escribir: escritura.escribir,
  });
}

const HOY = hoyEnLima();
const sumarDias = (fecha: string, dias: number) => new Date(Date.parse(`${fecha}T12:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
const regla = (mensaje: string) => ({ ok: false, tipo: "regla", mensaje });
const porId = async (tx: Tx, id: number) => (await tx.select().from(donaciones).where(eq(donaciones.id, id)))[0];
const historial = (tx: Tx, id: number) => tx.select().from(auditLog).where(and(eq(auditLog.entidad, "donacion"), eq(auditLog.entidadId, id)));

async function escenario(tx: Tx) {
  const [r, donante, proyecto, otro] = [
    await crearResponsable(tx, { nombre: "Ana Responsable" }),
    await crearApoyante(tx, { nombre: "Rosa Quispe", contacto: "999 888 777", esDonante: true }),
    await crearProyecto(tx, { tieneMeta: true }),
    await crearProyecto(tx, { tieneMeta: true }),
  ];
  const [item, item2, itemOtro] = [await crearItem(tx, proyecto.id, { nombre: "Pack" }), await crearItem(tx, proyecto.id, { nombre: "Cereal" }), await crearItem(tx, otro.id, { nombre: "Agua" })];
  return { r, donante, proyecto, otro, item, item2, itemOtro };
}

type Valores = Partial<typeof donaciones.$inferInsert>;
async function crear(tx: Tx, responsableId: number, apoyanteId: number, v: Valores) {
  const [d] = await tx.insert(donaciones).values({ apoyanteId, tipo: "dinero", monto: "150.50", medio: "yape", fecha: HOY, registradoPor: responsableId, ...v }).returning();
  return d;
}
const dineroEn = (tx: Tx, r: { id: number }, a: { id: number }, proyectoId: number | null, v: Valores = {}) => crear(tx, r.id, a.id, { proyectoId, ...v });
const productoEn = (tx: Tx, r: { id: number }, a: { id: number }, proyectoId: number, itemId: number, v: Valores = {}) =>
  crear(tx, r.id, a.id, { tipo: "producto", monto: null, medio: null, cantidad: 500, proyectoId, itemId, ...v });

describe("editar una donación", () => {
  const edicionDinero = (d: { id: number }, proyectoId: number | string, extra: Record<string, unknown> = {}) => ({ donacionId: d.id, proyectoId, fecha: HOY, monto: "150,50", medio: "yape", ...extra });

  test("corregir el monto: historial con antes y después atribuido a quien edita; registrado_por no cambia", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const otroResp = await crearResponsable(tx);
      const d = await dineroEn(tx, r, donante, proyecto.id);
      const res = await ejecutar(tx, otroResp.id, editarDonacion, edicionDinero(d, proyecto.id, { monto: "105,50" }));
      assert.ok(res.ok);
      const despues = await porId(tx, d.id);
      assert.deepEqual([despues.monto, despues.registradoPor], ["105.50", r.id]);
      const [h] = await historial(tx, d.id);
      assert.deepEqual([h.accion, h.responsableId], ["editar", otroResp.id]);
      assert.equal((h.antes as { monto: string }).monto, "150.50");
      assert.equal((h.despues as { monto: string }).monto, "105.50");
    }));

  test("corregir la cantidad de un producto", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto, item } = await escenario(tx);
      const d = await productoEn(tx, r, donante, proyecto.id, item.id);
      const res = await ejecutar(tx, r.id, editarDonacion, { donacionId: d.id, proyectoId: proyecto.id, itemId: item.id, cantidad: "450", fecha: HOY });
      assert.ok(res.ok);
      assert.equal((await porId(tx, d.id)).cantidad, 450);
      assert.equal(((await historial(tx, d.id))[0].antes as { cantidad: number }).cantidad, 500);
    }));

  test("medio y fecha se pueden corregir", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const d = await dineroEn(tx, r, donante, proyecto.id);
      const res = await ejecutar(tx, r.id, editarDonacion, edicionDinero(d, proyecto.id, { medio: "plin", fecha: sumarDias(HOY, -3) }));
      assert.ok(res.ok);
      const despues = await porId(tx, d.id);
      assert.deepEqual([despues.medio, despues.fecha], ["plin", sumarDias(HOY, -3)]);
    }));

  test("el tipo y el donante no cambian aunque vengan en la entrada", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const otro = await crearApoyante(tx, { nombre: "Otro", esDonante: true });
      const d = await dineroEn(tx, r, donante, proyecto.id);
      const res = await ejecutar(tx, r.id, editarDonacion, edicionDinero(d, proyecto.id, { monto: "99", tipo: "producto", apoyanteId: otro.id, donacionVinculadaId: 1 }));
      assert.ok(res.ok);
      const despues = await porId(tx, d.id);
      assert.deepEqual([despues.tipo, despues.apoyanteId, despues.donacionVinculadaId, despues.monto], ["dinero", donante.id, null, "99.00"]);
    }));

  test("sin cambios no escribe nada", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const d = await dineroEn(tx, r, donante, proyecto.id);
      assert.deepEqual(await ejecutar(tx, r.id, editarDonacion, edicionDinero(d, proyecto.id)), regla("No hay cambios para guardar"));
      assert.equal((await historial(tx, d.id)).length, 0);
    }));

  test("aplica las reglas del registro: medio obligatorio, fecha futura, ítem ajeno, descripción obligatoria", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto, itemOtro, item } = await escenario(tx);
      const d = await dineroEn(tx, r, donante, proyecto.id);
      const sinMedio = await ejecutar(tx, r.id, editarDonacion, edicionDinero(d, proyecto.id, { medio: undefined }));
      assert.ok(!sinMedio.ok && sinMedio.tipo === "validacion" && sinMedio.errores.medio);
      assert.deepEqual(await ejecutar(tx, r.id, editarDonacion, edicionDinero(d, proyecto.id, { fecha: sumarDias(HOY, 1) })), regla("La fecha no puede ser futura"));
      const p = await productoEn(tx, r, donante, proyecto.id, item.id);
      assert.deepEqual(await ejecutar(tx, r.id, editarDonacion, { donacionId: p.id, proyectoId: proyecto.id, itemId: itemOtro.id, cantidad: "5", fecha: HOY }), regla("El ítem no pertenece al proyecto elegido"));
      const sinDescripcion = await ejecutar(tx, r.id, editarDonacion, { donacionId: p.id, proyectoId: "sin-asignar", cantidad: "5", fecha: HOY });
      assert.ok(!sinDescripcion.ok && sinDescripcion.tipo === "validacion" && sinDescripcion.errores.descripcionProducto);
      assert.equal((await porId(tx, d.id)).monto, "150.50");
    }));

  test("reasignar a otro proyecto (dinero) y a otro ítem (producto)", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto, otro, item, item2 } = await escenario(tx);
      const d = await dineroEn(tx, r, donante, proyecto.id);
      assert.ok((await ejecutar(tx, r.id, editarDonacion, edicionDinero(d, otro.id))).ok);
      assert.equal((await porId(tx, d.id)).proyectoId, otro.id);
      const h = (await historial(tx, d.id))[0];
      assert.deepEqual([(h.antes as { proyectoId: number }).proyectoId, (h.despues as { proyectoId: number }).proyectoId], [proyecto.id, otro.id]);
      const p = await productoEn(tx, r, donante, proyecto.id, item.id);
      assert.ok((await ejecutar(tx, r.id, editarDonacion, { donacionId: p.id, proyectoId: proyecto.id, itemId: item2.id, cantidad: "500", fecha: HOY })).ok);
      assert.equal((await porId(tx, p.id)).itemId, item2.id);
    }));

  test("dejar sin asignar: dinero queda sin proyecto y producto exige descripción", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto, item } = await escenario(tx);
      const d = await dineroEn(tx, r, donante, proyecto.id);
      assert.ok((await ejecutar(tx, r.id, editarDonacion, edicionDinero(d, "sin-asignar"))).ok);
      assert.equal((await porId(tx, d.id)).proyectoId, null);
      const p = await productoEn(tx, r, donante, proyecto.id, item.id);
      assert.ok((await ejecutar(tx, r.id, editarDonacion, { donacionId: p.id, proyectoId: "sin-asignar", descripcionProducto: "Cajas", cantidad: "500", fecha: HOY })).ok);
      const despues = await porId(tx, p.id);
      assert.deepEqual([despues.proyectoId, despues.itemId, despues.descripcionProducto], [null, null, "Cajas"]);
    }));

  test("destino finalizado, donación anulada y proyecto actual finalizado se rechazan", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const cerrado = await crearProyecto(tx, { estado: "finalizado", resultado: "x" });
      const d = await dineroEn(tx, r, donante, proyecto.id);
      assert.deepEqual(await ejecutar(tx, r.id, editarDonacion, edicionDinero(d, cerrado.id)), regla("Este proyecto ya está finalizado"));
      const anulada = await dineroEn(tx, r, donante, proyecto.id, { anulada: true });
      assert.deepEqual(await ejecutar(tx, r.id, editarDonacion, edicionDinero(anulada, proyecto.id, { monto: "1" })), regla("Esta donación está anulada y no se puede modificar"));
      const enCerrado = await dineroEn(tx, r, donante, cerrado.id);
      assert.deepEqual(await ejecutar(tx, r.id, editarDonacion, edicionDinero(enCerrado, proyecto.id, { monto: "1" })), regla("El proyecto de esta donación está finalizado: no se puede modificar"));
      assert.equal((await porId(tx, enCerrado.id)).proyectoId, cerrado.id);
    }));

  test("fecha con reloj inyectado: el día de Lima a las 21:00 aún es hoy", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const d = await dineroEn(tx, r, donante, proyecto.id, { fecha: "2026-11-01" });
      const reloj = crearEditarDonacion(() => new Date("2026-11-04T02:00:00Z"));
      assert.ok((await ejecutar(tx, r.id, reloj, edicionDinero(d, proyecto.id, { fecha: "2026-11-03" }))).ok);
      assert.deepEqual(await ejecutar(tx, r.id, reloj, edicionDinero(d, proyecto.id, { fecha: "2026-11-04" })), regla("La fecha no puede ser futura"));
    }));

  test("duplicado: avisa, se confirma y no se cuenta a sí misma", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      await dineroEn(tx, r, donante, proyecto.id, { monto: "200.00" });
      const d = await dineroEn(tx, r, donante, proyecto.id, { monto: "150.50" });
      const aviso = await ejecutar(tx, r.id, editarDonacion, edicionDinero(d, proyecto.id, { monto: "200" }));
      assert.ok(!aviso.ok && aviso.tipo === "advertencia" && /Ya hay 1 donación igual/.test(aviso.mensaje) && !/Rosa|Quispe/.test(aviso.mensaje));
      assert.equal((await porId(tx, d.id)).monto, "150.50");
      const confirmada = await ejecutar(tx, r.id, editarDonacion, edicionDinero(d, proyecto.id, { monto: "200", confirmarDuplicado: "on" }));
      assert.ok(confirmada.ok);
      assert.equal(((await historial(tx, d.id))[0].despues as { duplicadoConfirmado: boolean }).duplicadoConfirmado, true);
      // cambiar solo el medio no cambia los datos de comparación: no se avisa por coincidir consigo misma
      const unica = await dineroEn(tx, r, donante, proyecto.id, { monto: "77.00" });
      assert.ok((await ejecutar(tx, r.id, editarDonacion, edicionDinero(unica, proyecto.id, { monto: "77", medio: "plin" }))).ok);
    }));

  test("responsable desactivado: no escribe", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const desactivado = await crearResponsable(tx, { activo: false });
      const d = await dineroEn(tx, r, donante, proyecto.id);
      assert.deepEqual(await ejecutar(tx, desactivado.id, editarDonacion, edicionDinero(d, proyecto.id, { monto: "1" })), { ok: false, tipo: "no_autorizado" });
      assert.equal((await porId(tx, d.id)).monto, "150.50");
    }));
});

describe("asignar una donación sin asignar", () => {
  test("dinero: queda asignada con una sola fila de historial de asignación", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const d = await dineroEn(tx, r, donante, null);
      assert.ok((await ejecutar(tx, r.id, asignarDonacion, { donacionId: d.id, proyectoId: proyecto.id })).ok);
      assert.equal((await porId(tx, d.id)).proyectoId, proyecto.id);
      const filas = await historial(tx, d.id);
      assert.equal(filas.length, 1);
      assert.equal(filas[0].accion, "asignar");
      assert.equal((filas[0].antes as { proyectoId: number | null }).proyectoId, null);
      assert.equal((filas[0].despues as { proyectoId: number }).proyectoId, proyecto.id);
    }));

  test("producto: proyecto e ítem a la vez, descripción borrada y el historial la conserva", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto, item } = await escenario(tx);
      const d = await crear(tx, r.id, donante.id, { tipo: "producto", monto: null, medio: null, cantidad: 20, descripcionProducto: "Cajas de cereal" });
      assert.ok((await ejecutar(tx, r.id, asignarDonacion, { donacionId: d.id, proyectoId: proyecto.id, itemId: item.id })).ok);
      const despues = await porId(tx, d.id);
      assert.deepEqual([despues.proyectoId, despues.itemId, despues.descripcionProducto, despues.cantidad], [proyecto.id, item.id, null, 20]);
      const [h] = await historial(tx, d.id);
      assert.equal((h.antes as { descripcionProducto: string }).descripcionProducto, "Cajas de cereal");
    }));

  test("producto sin ítem, proyecto sin meta, finalizado, sin asignar como destino, ya asignada", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto, item } = await escenario(tx);
      const informativo = await crearProyecto(tx, { tieneMeta: false });
      const cerrado = await crearProyecto(tx, { estado: "finalizado", resultado: "x" });
      const p = await crear(tx, r.id, donante.id, { tipo: "producto", monto: null, medio: null, cantidad: 20, descripcionProducto: "Cajas" });
      const sinItem = await ejecutar(tx, r.id, asignarDonacion, { donacionId: p.id, proyectoId: proyecto.id });
      assert.ok(!sinItem.ok && sinItem.tipo === "validacion" && sinItem.errores.itemId?.[0] === "Elige el ítem");
      const sinMeta = await ejecutar(tx, r.id, asignarDonacion, { donacionId: p.id, proyectoId: informativo.id, itemId: item.id });
      assert.ok(!sinMeta.ok && sinMeta.tipo === "regla" && /no tiene meta/.test(sinMeta.mensaje));
      assert.deepEqual(await ejecutar(tx, r.id, asignarDonacion, { donacionId: p.id, proyectoId: cerrado.id, itemId: item.id }), regla("Este proyecto ya está finalizado"));
      const destino = await ejecutar(tx, r.id, asignarDonacion, { donacionId: p.id, proyectoId: "sin-asignar" });
      assert.ok(!destino.ok && destino.tipo === "validacion" && destino.errores.proyectoId);
      const asignada = await dineroEn(tx, r, donante, proyecto.id);
      assert.deepEqual(await ejecutar(tx, r.id, asignarDonacion, { donacionId: asignada.id, proyectoId: proyecto.id }), regla("Esta donación ya tiene proyecto: usa la edición para reasignarla"));
      assert.equal((await porId(tx, p.id)).proyectoId, null);
    }));

  test("duplicado al asignar: avisa y se confirma", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      await dineroEn(tx, r, donante, proyecto.id, { monto: "150.50" });
      const d = await dineroEn(tx, r, donante, null, { monto: "150.50" });
      const aviso = await ejecutar(tx, r.id, asignarDonacion, { donacionId: d.id, proyectoId: proyecto.id });
      assert.ok(!aviso.ok && aviso.tipo === "advertencia");
      assert.equal((await porId(tx, d.id)).proyectoId, null);
      assert.ok((await ejecutar(tx, r.id, asignarDonacion, { donacionId: d.id, proyectoId: proyecto.id, confirmarDuplicado: "on" })).ok);
    }));

  test("anulada no se asigna", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const d = await dineroEn(tx, r, donante, null, { anulada: true });
      assert.deepEqual(await ejecutar(tx, r.id, asignarDonacion, { donacionId: d.id, proyectoId: proyecto.id }), regla("Esta donación está anulada y no se puede modificar"));
    }));
});

describe("anular una donación", () => {
  test("la fila se conserva con sus valores y queda anulada; el motivo va al historial", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const d = await dineroEn(tx, r, donante, proyecto.id);
      const res = await ejecutar(tx, r.id, anularDonacion, { donacionId: d.id, motivo: "  Registrada dos veces  " });
      assert.ok(res.ok);
      const despues = await porId(tx, d.id);
      assert.deepEqual([despues.anulada, despues.monto, despues.proyectoId, despues.apoyanteId], [true, "150.50", proyecto.id, donante.id]);
      const [h] = await historial(tx, d.id);
      assert.equal(h.accion, "anular");
      assert.deepEqual(h.antes, { anulada: false, apoyanteId: donante.id });
      assert.deepEqual(h.despues, { anulada: true, motivo: "Registrada dos veces", apoyanteId: donante.id });
    }));

  test("motivo vacío, solo espacios o de 201 caracteres: no anula ni deja historial", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const d = await dineroEn(tx, r, donante, proyecto.id);
      for (const motivo of ["", "   ", "m".repeat(201)]) {
        const res = await ejecutar(tx, r.id, anularDonacion, { donacionId: d.id, motivo });
        assert.ok(!res.ok && res.tipo === "validacion" && res.errores.motivo);
      }
      assert.equal((await porId(tx, d.id)).anulada, false);
      assert.equal((await historial(tx, d.id)).length, 0);
    }));

  test("anular dos veces se rechaza", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const d = await dineroEn(tx, r, donante, proyecto.id);
      await ejecutar(tx, r.id, anularDonacion, { donacionId: d.id, motivo: "x" });
      assert.deepEqual(await ejecutar(tx, r.id, anularDonacion, { donacionId: d.id, motivo: "y" }), regla("Esta donación ya está anulada"));
      assert.equal((await historial(tx, d.id)).length, 1);
    }));

  test("de un proyecto finalizado no se anula; inexistente tampoco", () =>
    enTransaccion(async (tx) => {
      const { r, donante } = await escenario(tx);
      const cerrado = await crearProyecto(tx, { estado: "finalizado", resultado: "x" });
      const d = await dineroEn(tx, r, donante, cerrado.id);
      assert.deepEqual(await ejecutar(tx, r.id, anularDonacion, { donacionId: d.id, motivo: "x" }), regla("El proyecto de esta donación está finalizado: no se puede modificar"));
      assert.deepEqual(await ejecutar(tx, r.id, anularDonacion, { donacionId: 2_000_000_000, motivo: "x" }), regla("No se encontró la donación"));
    }));

  test("anular una parte de una donación mixta no anula la otra ni rompe el vínculo", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto, item } = await escenario(tx);
      const primera = await dineroEn(tx, r, donante, proyecto.id);
      const segunda = await productoEn(tx, r, donante, proyecto.id, item.id, { donacionVinculadaId: primera.id });
      assert.ok((await ejecutar(tx, r.id, anularDonacion, { donacionId: primera.id, motivo: "Error" })).ok);
      const otra = await porId(tx, segunda.id);
      assert.deepEqual([otra.anulada, otra.donacionVinculadaId], [false, primera.id]);
    }));

  test("lo anulado no cuenta como duplicado ni se puede vincular", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto, item } = await escenario(tx);
      const d = await dineroEn(tx, r, donante, proyecto.id);
      await ejecutar(tx, r.id, anularDonacion, { donacionId: d.id, motivo: "x" });
      const entrada = { tipo: "dinero", apoyanteId: donante.id, proyectoId: proyecto.id, fecha: HOY, monto: "150,50", medio: "yape" };
      assert.ok((await ejecutar(tx, r.id, registrarDonacion, entrada)).ok);
      const vincular = await ejecutar(tx, r.id, registrarDonacion, { ...entrada, tipo: "producto", cantidad: "3", itemId: item.id, donacionVinculadaId: d.id });
      assert.ok(!vincular.ok && vincular.tipo === "regla" && /anulada/.test(vincular.mensaje));
    }));

  test("el historial no tiene nombre ni contacto del donante", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const d = await dineroEn(tx, r, donante, proyecto.id);
      await ejecutar(tx, r.id, editarDonacion, { donacionId: d.id, proyectoId: proyecto.id, fecha: HOY, monto: "10", medio: "yape" });
      await ejecutar(tx, r.id, anularDonacion, { donacionId: d.id, motivo: "x" });
      const texto = JSON.stringify(await historial(tx, d.id));
      assert.ok(!/Rosa|Quispe|999 888 777/.test(texto));
    }));

  test("responsable desactivado no anula", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const desactivado = await crearResponsable(tx, { activo: false });
      const d = await dineroEn(tx, r, donante, proyecto.id);
      assert.deepEqual(await ejecutar(tx, desactivado.id, anularDonacion, { donacionId: d.id, motivo: "x" }), { ok: false, tipo: "no_autorizado" });
      assert.equal((await porId(tx, d.id)).anulada, false);
    }));
});
