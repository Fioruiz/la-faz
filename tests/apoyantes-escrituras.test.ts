import assert from "node:assert/strict";
import { after, describe, mock, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { crearApoyante, editarApoyante } from "../lib/apoyantes-escrituras";
import {
  MENSAJE_ERROR_GENERICO,
  ejecutarEscrituraAuditada,
  type DbTransaccional,
  type EscrituraAuditada,
} from "../lib/escritura-auditada-core";
import { verificarResponsableActivo } from "../lib/responsable-activo";
import { apoyantes, auditLog, donaciones, voluntariosInscritos } from "../lib/schema";
import { crearApoyante as crearApoyanteFila, crearResponsable, enTransaccion, pool, type Tx } from "./helpers";

after(() => pool.end());

function ejecutar<TEsquema extends z.ZodType, TDatos>(
  tx: Tx,
  responsableId: number,
  escritura: { esquema: TEsquema; escribir: EscrituraAuditada<TEsquema, TDatos>["escribir"] },
  entrada: Record<string, unknown>,
) {
  return ejecutarEscrituraAuditada({
    nombre: "prueba-apoyantes",
    db: tx as unknown as DbTransaccional,
    requerir: () => verificarResponsableActivo(tx, responsableId),
    entrada,
    esquema: escritura.esquema,
    escribir: escritura.escribir,
  });
}

const regla = (mensaje: string) => ({ ok: false, tipo: "regla", mensaje });
const porId = async (tx: Tx, id: number) => (await tx.select().from(apoyantes).where(eq(apoyantes.id, id)))[0];
const historial = (tx: Tx, id: number) =>
  tx.select().from(auditLog).where(and(eq(auditLog.entidad, "apoyante"), eq(auditLog.entidadId, id)));
const entrada = (extra: Record<string, unknown> = {}) => ({ nombre: "Rosa Quispe", esDonante: "on", ...extra });

describe("crear apoyante", () => {
  test("donante: no voluntario, no anónimo, con historial de creación atribuido", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const res = await ejecutar(tx, r.id, crearApoyante, entrada());
      assert.ok(res.ok);
      const a = await porId(tx, res.datos.id);
      assert.deepEqual([a.nombre, a.esDonante, a.esVoluntario, a.anonimoPublico, a.contacto], ["Rosa Quispe", true, false, false, null]);
      const [h] = await historial(tx, a.id);
      assert.deepEqual([h.accion, h.antes, h.responsableId], ["crear", null, r.id]);
      assert.deepEqual(h.despues, { nombre: "Rosa Quispe", esDonante: true, esVoluntario: false, anonimoPublico: false, tieneContacto: false });
    }));

  test("donante y voluntario, y anonimato marcado", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const res = await ejecutar(tx, r.id, crearApoyante, entrada({ esVoluntario: "on", anonimoPublico: "on" }));
      assert.ok(res.ok);
      const a = await porId(tx, res.datos.id);
      assert.deepEqual([a.esDonante, a.esVoluntario, a.anonimoPublico], [true, true, true]);
    }));

  test("sin rol: no se crea, no hay historial y se muestra el error", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const res = await ejecutar(tx, r.id, crearApoyante, { nombre: "Sin rol" });
      assert.ok(!res.ok && res.tipo === "validacion");
      assert.deepEqual(res.errores.roles, ["Elige al menos un rol"]);
      assert.equal((await tx.select().from(auditLog)).length, 0);
    }));

  test("datos inválidos: conserva lo escrito y no escribe", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const res = await ejecutar(tx, r.id, crearApoyante, entrada({ nombre: "", contacto: "c".repeat(201) }));
      assert.ok(!res.ok && res.tipo === "validacion");
      assert.ok(res.errores.nombre && res.errores.contacto);
      assert.equal(res.valores.esDonante, "on");
      assert.equal((await tx.select().from(auditLog)).length, 0);
    }));

  test("el mismo nombre se permite: son registros distintos", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const a = await ejecutar(tx, r.id, crearApoyante, entrada());
      const b = await ejecutar(tx, r.id, crearApoyante, entrada());
      assert.ok(a.ok && b.ok && a.datos.id !== b.datos.id);
    }));
});

describe("editar apoyante", () => {
  const editar = (a: { id: number }, extra: Record<string, unknown> = {}) => ({ apoyanteId: a.id, nombre: "Rosa Quispe", esDonante: "on", ...extra });

  test("cambio de nombre: el historial guarda antes y después", () =>
    enTransaccion(async (tx) => {
      const [r, a] = [await crearResponsable(tx), await crearApoyanteFila(tx, { nombre: "Rosa Quispe", esDonante: true })];
      const res = await ejecutar(tx, r.id, editarApoyante, editar(a, { nombre: "Rosa Quispe Huamán" }));
      assert.ok(res.ok);
      assert.equal((await porId(tx, a.id)).nombre, "Rosa Quispe Huamán");
      const [h] = await historial(tx, a.id);
      assert.equal(h.accion, "editar");
      assert.equal((h.antes as { nombre: string }).nombre, "Rosa Quispe");
      assert.equal((h.despues as { nombre: string }).nombre, "Rosa Quispe Huamán");
    }));

  test("sin cambios: no escribe nada", () =>
    enTransaccion(async (tx) => {
      const [r, a] = [await crearResponsable(tx), await crearApoyanteFila(tx, { nombre: "Rosa Quispe", esDonante: true })];
      assert.deepEqual(await ejecutar(tx, r.id, editarApoyante, editar(a)), regla("No hay cambios para guardar"));
      assert.equal((await historial(tx, a.id)).length, 0);
    }));

  test("apoyante inexistente", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const res = await ejecutar(tx, r.id, editarApoyante, { apoyanteId: 2_000_000_000, nombre: "X", esDonante: "on" });
      assert.deepEqual(res, regla("No se encontró el apoyante"));
    }));

  test("quedar sin ningún rol", () =>
    enTransaccion(async (tx) => {
      const [r, a] = [await crearResponsable(tx), await crearApoyanteFila(tx, { esDonante: true })];
      const res = await ejecutar(tx, r.id, editarApoyante, { apoyanteId: a.id, nombre: "Rosa Quispe" });
      assert.ok(!res.ok && res.tipo === "validacion" && res.errores.roles);
      assert.equal((await porId(tx, a.id)).esDonante, true);
    }));

  test("quitar el rol donante a quien tiene donaciones", () =>
    enTransaccion(async (tx) => {
      const [r, a] = [await crearResponsable(tx), await crearApoyanteFila(tx, { nombre: "Rosa Quispe", esDonante: true, esVoluntario: true })];
      await tx.insert(donaciones).values({ apoyanteId: a.id, tipo: "dinero", monto: "10", fecha: "2026-11-01", registradoPor: r.id });
      const res = await ejecutar(tx, r.id, editarApoyante, editar(a, { esDonante: undefined, esVoluntario: "on" }));
      assert.ok(!res.ok && res.tipo === "regla" && /donaciones/.test(res.mensaje));
      assert.equal((await porId(tx, a.id)).esDonante, true);
    }));

  test("quitar el rol voluntario a quien tiene inscripciones", () =>
    enTransaccion(async (tx) => {
      const [r, a] = [await crearResponsable(tx), await crearApoyanteFila(tx, { nombre: "Rosa Quispe", esDonante: true, esVoluntario: true })];
      await tx.insert(voluntariosInscritos).values({ apoyanteId: a.id, consentimientoVersion: "prueba" });
      const res = await ejecutar(tx, r.id, editarApoyante, editar(a, { esVoluntario: undefined }));
      assert.ok(!res.ok && res.tipo === "regla" && /inscripciones/.test(res.mensaje));
      assert.equal((await porId(tx, a.id)).esVoluntario, true);
    }));

  test("quitar un rol sin registros asociados se permite si queda otro", () =>
    enTransaccion(async (tx) => {
      const [r, a] = [await crearResponsable(tx), await crearApoyanteFila(tx, { nombre: "Rosa Quispe", esDonante: true, esVoluntario: true })];
      assert.ok((await ejecutar(tx, r.id, editarApoyante, editar(a, { esVoluntario: undefined }))).ok);
      assert.equal((await porId(tx, a.id)).esVoluntario, false);
    }));

  test("cambiar la marca de anonimato queda en el historial", () =>
    enTransaccion(async (tx) => {
      const [r, a] = [await crearResponsable(tx), await crearApoyanteFila(tx, { nombre: "Rosa Quispe", esDonante: true })];
      assert.ok((await ejecutar(tx, r.id, editarApoyante, editar(a, { anonimoPublico: "on" }))).ok);
      const [h] = await historial(tx, a.id);
      assert.equal((h.antes as { anonimoPublico: boolean }).anonimoPublico, false);
      assert.equal((h.despues as { anonimoPublico: boolean }).anonimoPublico, true);
    }));

  test("responsable desactivado: no escribe", () =>
    enTransaccion(async (tx) => {
      const [r, a] = [await crearResponsable(tx, { activo: false }), await crearApoyanteFila(tx, { nombre: "Rosa Quispe", esDonante: true })];
      assert.deepEqual(await ejecutar(tx, r.id, editarApoyante, editar(a, { nombre: "Otro" })), { ok: false, tipo: "no_autorizado" });
      assert.equal((await porId(tx, a.id)).nombre, "Rosa Quispe");
      const creacion = await ejecutar(tx, r.id, crearApoyante, entrada());
      assert.deepEqual(creacion, { ok: false, tipo: "no_autorizado" });
    }));
});

describe("privacidad: el contacto no pasa al historial ni a los logs", () => {
  test("creación con contacto: ninguna columna del historial lo contiene", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const res = await ejecutar(tx, r.id, crearApoyante, entrada({ contacto: "999 888 777" }));
      assert.ok(res.ok);
      assert.equal((await porId(tx, res.datos.id)).contacto, "999 888 777");
      const [h] = await historial(tx, res.datos.id);
      assert.ok(!JSON.stringify(h).includes("999 888 777"));
      assert.equal((h.despues as { tieneContacto: boolean }).tieneContacto, true);
    }));

  test("edición solo del contacto: se guarda y el historial no trae ni el valor anterior ni el nuevo", () =>
    enTransaccion(async (tx) => {
      const [r, a] = [await crearResponsable(tx), await crearApoyanteFila(tx, { nombre: "Rosa Quispe", esDonante: true, contacto: "111 222 333" })];
      const res = await ejecutar(tx, r.id, editarApoyante, { apoyanteId: a.id, nombre: "Rosa Quispe", esDonante: "on", contacto: "444 555 666" });
      assert.ok(res.ok);
      assert.equal((await porId(tx, a.id)).contacto, "444 555 666");
      const [h] = await historial(tx, a.id);
      const texto = JSON.stringify(h);
      assert.ok(!texto.includes("111 222 333") && !texto.includes("444 555 666"));
      assert.equal((h.despues as { contactoModificado?: boolean }).contactoModificado, true);
      assert.equal((h.antes as { contactoModificado?: boolean }).contactoModificado, undefined);
    }));

  test("quitar el contacto: tieneContacto pasa a falso, sin su valor", () =>
    enTransaccion(async (tx) => {
      const [r, a] = [await crearResponsable(tx), await crearApoyanteFila(tx, { nombre: "Rosa Quispe", esDonante: true, contacto: "111 222 333" })];
      assert.ok((await ejecutar(tx, r.id, editarApoyante, { apoyanteId: a.id, nombre: "Rosa Quispe", esDonante: "on", contacto: "" })).ok);
      assert.equal((await porId(tx, a.id)).contacto, null);
      const [h] = await historial(tx, a.id);
      assert.deepEqual([(h.antes as { tieneContacto: boolean }).tieneContacto, (h.despues as { tieneContacto: boolean }).tieneContacto], [true, false]);
      assert.ok(!JSON.stringify(h).includes("111 222 333"));
    }));

  test("fallo de la base: mensaje genérico y log sin nombre ni contacto", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const espia = mock.method(console, "error", () => {});
      // Un NUL en el nombre lo rechaza Postgres: es un fallo real de la base al guardar.
      const res = await ejecutarEscrituraAuditada({
        nombre: "prueba-fallo",
        db: tx as unknown as DbTransaccional,
        requerir: () => verificarResponsableActivo(tx, r.id),
        entrada: { nombre: "Rosa\u0000Secreta", contacto: "999 888 777", esDonante: true, esVoluntario: false, anonimoPublico: false },
        esquema: z.object({ nombre: z.string(), contacto: z.string(), esDonante: z.boolean(), esVoluntario: z.boolean(), anonimoPublico: z.boolean() }),
        escribir: (t, datos, resp) => crearApoyante.escribir(t, datos, resp),
      });
      const registrado = JSON.stringify(espia.mock.calls.map((c) => c.arguments));
      mock.restoreAll();
      assert.deepEqual(res, { ok: false, tipo: "error", mensaje: MENSAJE_ERROR_GENERICO });
      assert.ok(!registrado.includes("Secreta") && !registrado.includes("999 888 777"));
      assert.ok(!JSON.stringify(res).includes("Secreta"));
    }));
});
