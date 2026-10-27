import assert from "node:assert/strict";
import { after, describe, mock, test } from "node:test";
import { and, eq, sql } from "drizzle-orm";
import { apoyantes, auditLog, voluntariosInscritos } from "../lib/schema";
import { CONSENTIMIENTO_VOLUNTARIADO } from "../lib/sitio-contenido";
import { LIMITES, claveDeIp, contarIntentos } from "../lib/limite-intentos";
import { CAMPO_TRAMPA, MENSAJE_LIMITE, inscribirVoluntario } from "../lib/voluntariado-inscripcion-core";
import { crearApoyante, enTransaccion, pool, type Tx } from "./helpers";

after(() => pool.end());

const marca = () => Math.random().toString(36).slice(2, 8);
// Cada llamada usa por defecto una IP distinta, para que las pruebas que no hablan del límite no lo alcancen.
const enviar = (db: Parameters<typeof inscribirVoluntario>[0], entrada: Parameters<typeof inscribirVoluntario>[1], ip = `ip-${marca()}`) =>
  inscribirVoluntario(db, entrada, { claveIp: claveDeIp(ip) });
const envio = (m: string, extra: Record<string, unknown> = {}) => ({ nombre: `Rosa ${m}`, contacto: "999 888 777", consentimiento: "on", ...extra });
const porNombre = (tx: Tx, nombre: string) => tx.select().from(apoyantes).where(eq(apoyantes.nombre, nombre));
const inscripcionesDe = (tx: Tx, apoyanteId: number) =>
  tx.select().from(voluntariosInscritos).where(eq(voluntariosInscritos.apoyanteId, apoyanteId));

describe("inscribirVoluntario", () => {
  test("envío válido: apoyante voluntario no donante, contacto, versión y fecha", () =>
    enTransaccion(async (tx) => {
      const m = marca();
      const res = await enviar(tx, envio(m, { mensaje: "Puedo los sábados" }));
      assert.equal(res.ok, true);
      const [a] = await porNombre(tx, `Rosa ${m}`);
      assert.deepEqual([a.esVoluntario, a.esDonante, a.anonimoPublico, a.contacto], [true, false, false, "999 888 777"]);
      const [i] = await inscripcionesDe(tx, a.id);
      assert.equal(i.mensaje, "Puedo los sábados");
      assert.equal(i.consentimientoVersion, CONSENTIMIENTO_VOLUNTARIADO.version);
      assert.ok(i.creadoEn instanceof Date);
    }));

  test("acepta FormData y deja el mensaje vacío como null", () =>
    enTransaccion(async (tx) => {
      const m = marca();
      const f = new FormData();
      for (const [k, v] of Object.entries(envio(m))) f.set(k, String(v));
      assert.equal((await enviar(tx, f)).ok, true);
      const [a] = await porNombre(tx, `Rosa ${m}`);
      assert.equal((await inscripcionesDe(tx, a.id))[0].mensaje, null);
    }));

  test("dos envíos iguales crean dos apoyantes", () =>
    enTransaccion(async (tx) => {
      const m = marca();
      await enviar(tx, envio(m));
      await enviar(tx, envio(m));
      assert.equal((await porNombre(tx, `Rosa ${m}`)).length, 2);
    }));

  test("el contacto de un donante existente no lo modifica ni lo reutiliza", () =>
    enTransaccion(async (tx) => {
      const m = marca();
      const d = await crearApoyante(tx, { nombre: `Donante ${m}`, contacto: "999 888 777", esDonante: true });
      await enviar(tx, envio(m));
      const [despues] = await tx.select().from(apoyantes).where(eq(apoyantes.id, d.id));
      assert.deepEqual([despues.esVoluntario, despues.esDonante], [false, true]);
      assert.equal((await inscripcionesDe(tx, d.id)).length, 0);
    }));

  test("campo trampa lleno: no guarda nada y responde éxito igual que un envío válido", () =>
    enTransaccion(async (tx) => {
      const m = marca();
      const valido = await enviar(tx, envio(`v${m}`));
      const bot = await enviar(tx, envio(m, { [CAMPO_TRAMPA]: "http://spam.test" }));
      assert.deepEqual(bot, valido);
      assert.equal((await porNombre(tx, `Rosa ${m}`)).length, 0);
    }));

  test("campo trampa lleno aunque el resto sea inválido: igual éxito y sin guardar", () =>
    enTransaccion(async (tx) => {
      const res = await enviar(tx, { [CAMPO_TRAMPA]: "x", nombre: "" });
      assert.equal(res.ok, true);
    }));

  test("campo trampa vacío no descarta el envío", () =>
    enTransaccion(async (tx) => {
      const m = marca();
      await enviar(tx, envio(m, { [CAMPO_TRAMPA]: "" }));
      assert.equal((await porNombre(tx, `Rosa ${m}`)).length, 1);
    }));

  test("fuera de límites o sin consentimiento: validación por campo, sin guardar y con lo escrito", () =>
    enTransaccion(async (tx) => {
      const m = marca();
      const largo = await enviar(tx, envio(m, { nombre: "n".repeat(101), contacto: "c".repeat(201), mensaje: "m".repeat(501) }));
      assert.ok(!largo.ok && largo.tipo === "validacion");
      if (!largo.ok && largo.tipo === "validacion") {
        assert.deepEqual(Object.keys(largo.errores).sort(), ["contacto", "mensaje", "nombre"]);
        assert.equal(largo.valores.contacto, "c".repeat(201));
      }
      const sin = await enviar(tx, envio(m, { consentimiento: undefined }));
      assert.ok(!sin.ok && sin.tipo === "validacion" && sin.errores.consentimiento?.length);
      if (!sin.ok && sin.tipo === "validacion") assert.equal(sin.valores.nombre, `Rosa ${m}`);
      assert.equal((await porNombre(tx, `Rosa ${m}`)).length, 0);
    }));

  test("la versión del consentimiento no se toma de la entrada", () =>
    enTransaccion(async (tx) => {
      const m = marca();
      await enviar(tx, envio(m, { consentimientoVersion: "hackeada", consentimiento_version: "hackeada" }));
      const [a] = await porNombre(tx, `Rosa ${m}`);
      assert.equal((await inscripcionesDe(tx, a.id))[0].consentimientoVersion, CONSENTIMIENTO_VOLUNTARIADO.version);
    }));

  test("no escribe en audit_log", () =>
    enTransaccion(async (tx) => {
      const m = marca();
      const antes = (await tx.select().from(auditLog)).length;
      await enviar(tx, envio(m));
      assert.equal((await tx.select().from(auditLog)).length, antes);
    }));

  test("todo o nada: si falla la inscripción no queda el apoyante", () =>
    enTransaccion(async (tx) => {
      const m = marca();
      const conFallo = {
        select: tx.select.bind(tx),
        insert: tx.insert.bind(tx),
        delete: tx.delete.bind(tx),
        transaction: <T,>(fn: Parameters<Tx["transaction"]>[0]) =>
          tx.transaction(async (t) => {
            const original = t.insert.bind(t);
            (t as { insert: unknown }).insert = (tabla: unknown) => {
              if (tabla === voluntariosInscritos) throw Object.assign(new Error("Rosa 999 888 777 secreto"), { code: "XX000" });
              return original(tabla as typeof apoyantes);
            };
            return fn(t) as Promise<T>;
          }),
      };
      const registro = mock.method(console, "error", () => {});
      const res = await enviar(conFallo as never, envio(m));
      const log = JSON.stringify(registro.mock.calls.map((c) => c.arguments));
      registro.mock.restore();
      assert.ok(!res.ok && res.tipo === "error");
      if (!res.ok && res.tipo === "error") assert.deepEqual([res.valores.nombre, res.valores.contacto], [`Rosa ${m}`, "999 888 777"]);
      assert.equal((await porNombre(tx, `Rosa ${m}`)).length, 0);
      assert.match(log, /XX000/);
      assert.ok(!log.includes("999 888 777") && !log.includes(m) && !log.includes("secreto"));
      assert.ok(!JSON.stringify({ ...res, valores: undefined }).includes("999"));
    }));

  test("la inscripción no deja rastro de la entrada fuera de sus tablas", () =>
    enTransaccion(async (tx) => {
      const m = marca();
      await enviar(tx, envio(m));
      const filas = await tx.select().from(apoyantes).where(and(eq(apoyantes.nombre, `Rosa ${m}`), eq(apoyantes.esDonante, true)));
      assert.equal(filas.length, 0);
    }));

  test("sexto envío de una IP: no guarda nada, avisa y conserva lo escrito; otra IP pasa", () =>
    enTransaccion(async (tx) => {
      const [m, ip] = [marca(), `ip-${marca()}`];
      for (let i = 0; i < LIMITES.formulario.maximo; i++) assert.equal((await enviar(tx, envio(`${m}-${i}`), ip)).ok, true);
      const sexto = await enviar(tx, envio(`${m}-6`), ip);
      assert.ok(!sexto.ok && sexto.tipo === "limite");
      if (!sexto.ok && sexto.tipo === "limite") {
        assert.equal(sexto.mensaje, MENSAJE_LIMITE);
        assert.equal(sexto.valores.nombre, `Rosa ${m}-6`);
      }
      assert.equal((await porNombre(tx, `Rosa ${m}-6`)).length, 0);
      assert.equal((await enviar(tx, envio(`${m}-otra`), `otra-${ip}`)).ok, true);
      assert.equal((await porNombre(tx, `Rosa ${m}-otra`)).length, 1);
    }));

  test("los envíos descartados por el campo trampa y los inválidos también cuentan", () =>
    enTransaccion(async (tx) => {
      const [m, ip] = [marca(), `ip-${marca()}`];
      await enviar(tx, envio(m, { [CAMPO_TRAMPA]: "x" }), ip);
      await enviar(tx, envio(m, { nombre: "" }), ip);
      await enviar(tx, envio(m, { consentimiento: undefined }), ip);
      assert.equal(await contarIntentos(tx, "formulario", claveDeIp(ip)), 3);
      await enviar(tx, envio(m, { [CAMPO_TRAMPA]: "x" }), ip);
      await enviar(tx, envio(m, { [CAMPO_TRAMPA]: "x" }), ip);
      const sexto = await enviar(tx, envio(m), ip);
      assert.ok(!sexto.ok && sexto.tipo === "limite");
    }));

  test("la tabla de contadores no guarda la IP ni datos del formulario", () =>
    enTransaccion(async (tx) => {
      const [m, ip] = [marca(), `203.0.113.${Math.floor(Math.random() * 200)}`];
      await enviar(tx, envio(m, { contacto: "secreto-999" }), ip);
      const filas = await tx.execute(sql`select * from intentos_limitados where clave = ${claveDeIp(ip)}`);
      const json = JSON.stringify(filas.rows);
      assert.equal(filas.rows.length, 1);
      assert.ok(!json.includes(ip) && !json.includes(m) && !json.includes("secreto-999"));
    }));

  test("sin cabecera de IP todos comparten una clave fija", () => {
    assert.equal(claveDeIp(null), claveDeIp(""));
    assert.equal(claveDeIp("1.2.3.4, 5.6.7.8"), claveDeIp("1.2.3.4"));
    assert.notEqual(claveDeIp("1.2.3.4"), claveDeIp("1.2.3.5"));
  });

  test("si falla el contador no se guarda nada y se conserva lo escrito", () =>
    enTransaccion(async (tx) => {
      const m = marca();
      const sinContador = {
        select: () => { throw new Error("base caída"); },
        insert: () => { throw new Error("base caída"); },
        delete: () => { throw new Error("base caída"); },
        transaction: tx.transaction.bind(tx),
      };
      const registro = mock.method(console, "error", () => {});
      const res = await enviar(sinContador as never, envio(m));
      registro.mock.restore();
      assert.ok(!res.ok && res.tipo === "error");
      if (!res.ok && res.tipo === "error") assert.equal(res.valores.nombre, `Rosa ${m}`);
      assert.equal((await porNombre(tx, `Rosa ${m}`)).length, 0);
    }));
});
