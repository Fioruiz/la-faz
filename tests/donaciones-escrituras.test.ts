import assert from "node:assert/strict";
import { after, describe, mock, test } from "node:test";
import { and, eq } from "drizzle-orm";
import {
  ejecutarEscrituraAuditada,
  type DbTransaccional,
} from "../lib/escritura-auditada-core";
import { crearRegistrarDonacion, registrarDonacion } from "../lib/donaciones-escrituras";
import { hoyEnLima } from "../lib/fechas";
import { verificarResponsableActivo } from "../lib/responsable-activo";
import { auditLog, donaciones } from "../lib/schema";
import { crearApoyante, crearItem, crearProyecto, crearResponsable, enTransaccion, pool, type Tx } from "./helpers";

after(() => pool.end());

function registrar(tx: Tx, responsableId: number, entrada: Record<string, unknown>, escritura = registrarDonacion) {
  return ejecutarEscrituraAuditada({
    nombre: "prueba-donaciones",
    db: tx as unknown as DbTransaccional,
    requerir: () => verificarResponsableActivo(tx, responsableId),
    entrada,
    esquema: escritura.esquema,
    escribir: escritura.escribir,
  });
}

const regla = (mensaje: string) => ({ ok: false, tipo: "regla", mensaje });
const porId = async (tx: Tx, id: number) => (await tx.select().from(donaciones).where(eq(donaciones.id, id)))[0];
const historial = (tx: Tx, id: number) =>
  tx.select().from(auditLog).where(and(eq(auditLog.entidad, "donacion"), eq(auditLog.entidadId, id)));
const HOY = hoyEnLima();
const sumarDias = (fecha: string, dias: number) => new Date(Date.parse(`${fecha}T12:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);

const dinero = (apoyanteId: number, proyectoId: number | string, extra: Record<string, unknown> = {}) => ({
  tipo: "dinero", apoyanteId, proyectoId, fecha: HOY, monto: "150,50", medio: "yape", ...extra,
});
const producto = (apoyanteId: number, proyectoId: number | string, extra: Record<string, unknown> = {}) => ({
  tipo: "producto", apoyanteId, proyectoId, fecha: HOY, cantidad: "500", ...extra,
});

async function escenario(tx: Tx, extraProyecto: Partial<Parameters<typeof crearProyecto>[1]> = {}) {
  const [r, donante, proyecto] = [
    await crearResponsable(tx),
    await crearApoyante(tx, { nombre: "Rosa Quispe", contacto: "999 888 777", esDonante: true }),
    await crearProyecto(tx, { tieneMeta: true, ...extraProyecto }),
  ];
  const item = await crearItem(tx, proyecto.id, { nombre: "Pack", unidad: "pack", cantidadMeta: 2000 });
  return { r, donante, proyecto, item };
}

describe("registrar dinero", () => {
  test("asignado a un proyecto: queda atribuido al responsable con su historial", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const res = await registrar(tx, r.id, dinero(donante.id, proyecto.id));
      assert.ok(res.ok);
      const d = await porId(tx, res.datos.id);
      assert.deepEqual(
        [d.tipo, d.monto, d.medio, d.proyectoId, d.itemId, d.cantidad, d.apoyanteId, d.registradoPor, d.anulada],
        ["dinero", "150.50", "yape", proyecto.id, null, null, donante.id, r.id, false],
      );
      const [h] = await historial(tx, d.id);
      assert.deepEqual([h.accion, h.antes, h.responsableId], ["crear", null, r.id]);
      assert.equal((h.despues as { monto: string }).monto, "150.50");
    }));

  test("sin asignar y a un proyecto sin meta se guarda", () =>
    enTransaccion(async (tx) => {
      const { r, donante } = await escenario(tx);
      const informativo = await crearProyecto(tx, { tieneMeta: false });
      const a = await registrar(tx, r.id, dinero(donante.id, "sin-asignar"));
      const b = await registrar(tx, r.id, dinero(donante.id, informativo.id, { monto: "20" }));
      assert.ok(a.ok && b.ok);
      assert.equal((await porId(tx, a.datos.id)).proyectoId, null);
      assert.equal((await porId(tx, b.datos.id)).proyectoId, informativo.id);
    }));

  test("medio obligatorio y monto inválido: no guarda ni deja historial", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const sinMedio = await registrar(tx, r.id, dinero(donante.id, proyecto.id, { medio: undefined }));
      assert.ok(!sinMedio.ok && sinMedio.tipo === "validacion" && sinMedio.errores.medio);
      const malo = await registrar(tx, r.id, dinero(donante.id, proyecto.id, { monto: "0" }));
      assert.ok(!malo.ok && malo.tipo === "validacion" && malo.errores.monto);
      assert.equal((await tx.select().from(auditLog)).length, 0);
      assert.equal((await tx.select().from(donaciones)).length, 0);
    }));
});

describe("registrar producto", () => {
  test("asignado: ítem del proyecto, cantidad, sin monto ni medio", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto, item } = await escenario(tx);
      const res = await registrar(tx, r.id, producto(donante.id, proyecto.id, { itemId: item.id, monto: "99", medio: "yape" }));
      assert.ok(res.ok);
      const d = await porId(tx, res.datos.id);
      assert.deepEqual([d.tipo, d.proyectoId, d.itemId, d.cantidad, d.monto, d.medio, d.descripcionProducto], ["producto", proyecto.id, item.id, 500, null, null, null]);
    }));

  test("sin asignar: descripción, sin ítem ni proyecto", () =>
    enTransaccion(async (tx) => {
      const { r, donante } = await escenario(tx);
      const res = await registrar(tx, r.id, producto(donante.id, "sin-asignar", { cantidad: "20", descripcionProducto: "Cajas de cereal", itemId: 12345 }));
      assert.ok(res.ok);
      const d = await porId(tx, res.datos.id);
      assert.deepEqual([d.proyectoId, d.itemId, d.cantidad, d.descripcionProducto], [null, null, 20, "Cajas de cereal"]);
    }));

  test("sin asignar sin descripción y producto asignado sin ítem: no guarda", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const a = await registrar(tx, r.id, producto(donante.id, "sin-asignar"));
      const b = await registrar(tx, r.id, producto(donante.id, proyecto.id));
      assert.ok(!a.ok && a.tipo === "validacion" && a.errores.descripcionProducto);
      assert.ok(!b.ok && b.tipo === "validacion" && b.errores.itemId);
      assert.equal((await tx.select().from(donaciones)).length, 0);
    }));

  test("ítem de otro proyecto", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const otro = await crearProyecto(tx, { tieneMeta: true });
      const itemAjeno = await crearItem(tx, otro.id, { nombre: "Ajeno" });
      const res = await registrar(tx, r.id, producto(donante.id, proyecto.id, { itemId: itemAjeno.id }));
      assert.deepEqual(res, regla("El ítem no pertenece al proyecto elegido"));
      assert.equal((await tx.select().from(auditLog)).length, 0);
    }));

  test("proyecto sin meta", () =>
    enTransaccion(async (tx) => {
      const { r, donante } = await escenario(tx);
      const informativo = await crearProyecto(tx, { tieneMeta: false });
      const res = await registrar(tx, r.id, producto(donante.id, informativo.id, { itemId: 1 }));
      assert.ok(!res.ok && res.tipo === "regla" && /no tiene meta/.test(res.mensaje));
    }));
});

describe("reglas de proyecto, donante y fecha", () => {
  test("proyecto finalizado e inexistente", () =>
    enTransaccion(async (tx) => {
      const { r, donante } = await escenario(tx);
      const cerrado = await crearProyecto(tx, { estado: "finalizado", resultado: "x" });
      assert.deepEqual(await registrar(tx, r.id, dinero(donante.id, cerrado.id)), regla("Este proyecto ya está finalizado"));
      assert.deepEqual(await registrar(tx, r.id, dinero(donante.id, 2_000_000_000)), regla("No se encontró el proyecto"));
      assert.equal((await tx.select().from(donaciones)).length, 0);
    }));

  test("donante sin rol de donante e inexistente", () =>
    enTransaccion(async (tx) => {
      const { r, proyecto } = await escenario(tx);
      const voluntario = await crearApoyante(tx, { nombre: "Solo voluntario", esDonante: false, esVoluntario: true });
      assert.deepEqual(await registrar(tx, r.id, dinero(voluntario.id, proyecto.id)), regla("Esta persona no es donante"));
      assert.deepEqual(await registrar(tx, r.id, dinero(2_000_000_000, proyecto.id)), regla("No se encontró al donante"));
    }));

  test("fecha futura se rechaza, hoy y pasada se aceptan", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      assert.deepEqual(await registrar(tx, r.id, dinero(donante.id, proyecto.id, { fecha: sumarDias(HOY, 1) })), regla("La fecha no puede ser futura"));
      const hoy = await registrar(tx, r.id, dinero(donante.id, proyecto.id, { fecha: HOY, monto: "1" }));
      const pasada = await registrar(tx, r.id, dinero(donante.id, proyecto.id, { fecha: sumarDias(HOY, -7), monto: "2" }));
      assert.ok(hoy.ok && pasada.ok);
      assert.equal((await porId(tx, pasada.datos.id)).fecha, sumarDias(HOY, -7));
    }));

  test("fecha con reloj inyectado: a las 21:00 de Lima (02:00 UTC) el día de Lima aún es hoy", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const reloj = crearRegistrarDonacion(() => new Date("2026-11-04T02:00:00Z"));
      assert.ok((await registrar(tx, r.id, dinero(donante.id, proyecto.id, { fecha: "2026-11-03" }), reloj)).ok);
      assert.deepEqual(await registrar(tx, r.id, dinero(donante.id, proyecto.id, { fecha: "2026-11-04", monto: "9" }), reloj), regla("La fecha no puede ser futura"));
    }));
});

describe("historial y acceso", () => {
  test("el historial guarda el id del donante y no su nombre ni su contacto", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const res = await registrar(tx, r.id, dinero(donante.id, proyecto.id));
      assert.ok(res.ok);
      const [h] = await historial(tx, res.datos.id);
      const texto = JSON.stringify(h);
      assert.ok(!texto.includes("Rosa") && !texto.includes("Quispe") && !texto.includes("999 888 777"));
      assert.equal((h.despues as { apoyanteId: number }).apoyanteId, donante.id);
    }));

  test("atribuye al responsable de la sesión aunque la entrada traiga otro", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const otro = await crearResponsable(tx);
      const res = await registrar(tx, r.id, dinero(donante.id, proyecto.id, { registradoPor: otro.id, responsableId: otro.id }));
      assert.ok(res.ok);
      assert.equal((await porId(tx, res.datos.id)).registradoPor, r.id);
      assert.equal((await historial(tx, res.datos.id))[0].responsableId, r.id);
    }));

  test("responsable desactivado: no guarda nada", () =>
    enTransaccion(async (tx) => {
      const { donante, proyecto } = await escenario(tx);
      const desactivado = await crearResponsable(tx, { activo: false });
      assert.deepEqual(await registrar(tx, desactivado.id, dinero(donante.id, proyecto.id)), { ok: false, tipo: "no_autorizado" });
      assert.equal((await tx.select().from(donaciones)).length, 0);
    }));
});

describe("aviso de duplicados", () => {
  const advertencia = (res: unknown) => (res as { ok: boolean; tipo?: string; mensaje?: string });

  test("dinero igual: avisa sin guardar; confirmado guarda y lo marca en el historial", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      assert.ok((await registrar(tx, r.id, dinero(donante.id, proyecto.id))).ok);
      const aviso = advertencia(await registrar(tx, r.id, dinero(donante.id, proyecto.id)));
      assert.equal(aviso.tipo, "advertencia");
      assert.match(aviso.mensaje ?? "", /Ya hay 1 donación igual \(dinero, \d{4}-\d{2}-\d{2}, /);
      assert.equal((await tx.select().from(donaciones)).length, 1);
      const confirmado = await registrar(tx, r.id, dinero(donante.id, proyecto.id, { confirmarDuplicado: "on" }));
      assert.ok(confirmado.ok);
      assert.equal((await tx.select().from(donaciones)).length, 2);
      assert.equal(((await historial(tx, confirmado.datos.id))[0].despues as { duplicadoConfirmado: boolean }).duplicadoConfirmado, true);
    }));

  test("el mensaje no incluye el nombre del donante", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      await registrar(tx, r.id, dinero(donante.id, proyecto.id));
      const aviso = advertencia(await registrar(tx, r.id, dinero(donante.id, proyecto.id)));
      assert.ok(!/Rosa|Quispe|999/.test(aviso.mensaje ?? ""));
    }));

  test("cambiar donante, monto, fecha o proyecto evita el aviso", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const otroDonante = await crearApoyante(tx, { nombre: "Otro", esDonante: true });
      const otroProyecto = await crearProyecto(tx);
      assert.ok((await registrar(tx, r.id, dinero(donante.id, proyecto.id))).ok);
      for (const variante of [
        dinero(otroDonante.id, proyecto.id),
        dinero(donante.id, proyecto.id, { monto: "151" }),
        dinero(donante.id, proyecto.id, { fecha: sumarDias(HOY, -1) }),
        dinero(donante.id, otroProyecto.id),
      ]) {
        assert.equal((await registrar(tx, r.id, variante)).ok, true);
      }
    }));

  test("dos sin asignar iguales cuentan como iguales", () =>
    enTransaccion(async (tx) => {
      const { r, donante } = await escenario(tx);
      assert.ok((await registrar(tx, r.id, dinero(donante.id, "sin-asignar"))).ok);
      assert.equal(advertencia(await registrar(tx, r.id, dinero(donante.id, "sin-asignar"))).tipo, "advertencia");
    }));

  test("producto asignado igual avisa; otra cantidad u otro ítem no", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto, item } = await escenario(tx);
      const item2 = await crearItem(tx, proyecto.id, { nombre: "Otro ítem" });
      assert.ok((await registrar(tx, r.id, producto(donante.id, proyecto.id, { itemId: item.id }))).ok);
      assert.equal(advertencia(await registrar(tx, r.id, producto(donante.id, proyecto.id, { itemId: item.id }))).tipo, "advertencia");
      assert.ok((await registrar(tx, r.id, producto(donante.id, proyecto.id, { itemId: item.id, cantidad: "501" }))).ok);
      assert.ok((await registrar(tx, r.id, producto(donante.id, proyecto.id, { itemId: item2.id }))).ok);
    }));

  test("producto sin asignar: descripción en otra capitalización y con tildes cuenta igual", () =>
    enTransaccion(async (tx) => {
      const { r, donante } = await escenario(tx);
      const base = (d: string) => producto(donante.id, "sin-asignar", { cantidad: "20", descripcionProducto: d });
      assert.ok((await registrar(tx, r.id, base("Cajas de cereal"))).ok);
      assert.equal(advertencia(await registrar(tx, r.id, base("  cajas DE cereal "))).tipo, "advertencia");
      assert.ok((await registrar(tx, r.id, base("Botellas de agua"))).ok);
    }));

  test("distinto tipo no avisa", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto, item } = await escenario(tx);
      assert.ok((await registrar(tx, r.id, dinero(donante.id, proyecto.id))).ok);
      assert.ok((await registrar(tx, r.id, producto(donante.id, proyecto.id, { itemId: item.id }))).ok);
    }));

  test("una anulada no cuenta como duplicado", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const primera = await registrar(tx, r.id, dinero(donante.id, proyecto.id));
      assert.ok(primera.ok);
      await tx.update(donaciones).set({ anulada: true }).where(eq(donaciones.id, primera.datos.id));
      assert.ok((await registrar(tx, r.id, dinero(donante.id, proyecto.id))).ok);
    }));

  test("la advertencia no es un error: no va al log", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      await registrar(tx, r.id, dinero(donante.id, proyecto.id));
      const espia = mock.method(console, "error", () => {});
      await registrar(tx, r.id, dinero(donante.id, proyecto.id));
      const llamadas = espia.mock.callCount();
      mock.restoreAll();
      assert.equal(llamadas, 0);
    }));
});

describe("donación mixta", () => {
  test("la segunda parte queda vinculada a la primera, cada una por separado, con el vínculo en el historial", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto, item } = await escenario(tx);
      const primera = await registrar(tx, r.id, dinero(donante.id, proyecto.id));
      assert.ok(primera.ok);
      const segunda = await registrar(tx, r.id, producto(donante.id, proyecto.id, { itemId: item.id, donacionVinculadaId: primera.datos.id }));
      assert.ok(segunda.ok);
      const d2 = await porId(tx, segunda.datos.id);
      assert.deepEqual([d2.donacionVinculadaId, d2.tipo, d2.apoyanteId], [primera.datos.id, "producto", donante.id]);
      assert.equal((await porId(tx, primera.datos.id)).donacionVinculadaId, null);
      assert.equal(((await historial(tx, d2.id))[0].despues as { donacionVinculadaId: number }).donacionVinculadaId, primera.datos.id);
    }));

  test("la segunda parte puede ir a otro proyecto o sin asignar", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const primera = await registrar(tx, r.id, dinero(donante.id, proyecto.id));
      assert.ok(primera.ok);
      const segunda = await registrar(tx, r.id, producto(donante.id, "sin-asignar", { descripcionProducto: "Cajas", donacionVinculadaId: primera.datos.id }));
      assert.ok(segunda.ok);
      assert.equal((await porId(tx, segunda.datos.id)).proyectoId, null);
    }));

  test("rechaza otro donante, mismo tipo, anulada, inexistente y ya vinculada en ambos sentidos", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto, item } = await escenario(tx);
      const otro = await crearApoyante(tx, { nombre: "Otro", esDonante: true });
      const primera = await registrar(tx, r.id, dinero(donante.id, proyecto.id));
      assert.ok(primera.ok);
      const prod = (extra: Record<string, unknown>) => producto(donante.id, proyecto.id, { itemId: item.id, ...extra });
      assert.deepEqual(await registrar(tx, r.id, producto(otro.id, proyecto.id, { itemId: item.id, donacionVinculadaId: primera.datos.id })), regla("La donación vinculada debe ser del mismo donante"));
      assert.deepEqual(await registrar(tx, r.id, dinero(donante.id, proyecto.id, { monto: "7", donacionVinculadaId: primera.datos.id })), regla("La donación vinculada debe ser de tipo distinto (dinero y producto)"));
      assert.deepEqual(await registrar(tx, r.id, prod({ donacionVinculadaId: 2_000_000_000 })), regla("No se encontró la donación a vincular"));
      const segunda = await registrar(tx, r.id, prod({ donacionVinculadaId: primera.datos.id }));
      assert.ok(segunda.ok);
      // la primera ya tiene una apuntándole; la segunda ya apunta a otra
      assert.deepEqual(await registrar(tx, r.id, prod({ cantidad: "9", donacionVinculadaId: primera.datos.id })), regla("Esa donación ya forma parte de una donación mixta"));
      assert.deepEqual(await registrar(tx, r.id, dinero(donante.id, proyecto.id, { monto: "8", donacionVinculadaId: segunda.datos.id })), regla("Esa donación ya forma parte de una donación mixta"));
      await tx.update(donaciones).set({ anulada: true }).where(eq(donaciones.id, primera.datos.id));
      const sola = await registrar(tx, r.id, dinero(donante.id, proyecto.id, { monto: "3" }));
      assert.ok(sola.ok);
      await tx.update(donaciones).set({ anulada: true }).where(eq(donaciones.id, sola.datos.id));
      assert.deepEqual(await registrar(tx, r.id, prod({ cantidad: "4", donacionVinculadaId: sola.datos.id })), regla("No se puede vincular una donación anulada"));
    }));

  test("cada parte cumple sus reglas: segunda parte en proyecto finalizado se rechaza", () =>
    enTransaccion(async (tx) => {
      const { r, donante, proyecto } = await escenario(tx);
      const cerrado = await crearProyecto(tx, { tieneMeta: true, estado: "finalizado", resultado: "x" });
      const primera = await registrar(tx, r.id, dinero(donante.id, proyecto.id));
      assert.ok(primera.ok);
      const res = await registrar(tx, r.id, producto(donante.id, cerrado.id, { itemId: 1, donacionVinculadaId: primera.datos.id }));
      assert.deepEqual(res, regla("Este proyecto ya está finalizado"));
    }));
});
