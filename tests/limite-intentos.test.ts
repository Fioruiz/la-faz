import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import { LIMITES, claveHmac, claveDeIp, contarIntentos, limpiarIntentos, prefijoIpv6, registrarIntento, superaLimite } from "../lib/limite-intentos";
import { intentosLimitados } from "../lib/schema";
import { enTransaccion, pool, rechazo } from "./helpers";

after(() => pool.end());

const T0 = new Date("2026-10-27T12:00:00Z");
const despues = (ms: number) => new Date(T0.getTime() + ms);
const MIN = 60 * 1000;
const marca = () => Math.random().toString(36).slice(2, 8);

describe("claveHmac", () => {
  test("es estable, distinta por valor y por secreto, y no contiene el valor", () => {
    const a = claveHmac("rosa@correo.test", "secreto-1");
    assert.equal(a, claveHmac("rosa@correo.test", "secreto-1"));
    assert.notEqual(a, claveHmac("otra@correo.test", "secreto-1"));
    assert.notEqual(a, claveHmac("rosa@correo.test", "secreto-2"));
    assert.match(a, /^[0-9a-f]{64}$/);
    assert.ok(!a.includes("rosa"));
  });

  test("sin secreto falla cerrado", () => {
    assert.throws(() => claveHmac("x", ""), /AUTH_SECRET/);
  });
});

describe("superaLimite (login y formulario)", () => {
  test("5 intentos no superan el límite; el sexto sí", () =>
    enTransaccion(async (tx) => {
      const c = claveHmac(`a-${marca()}`, "s");
      for (let i = 0; i < 5; i++) await registrarIntento(tx, "login", c, despues(i * MIN));
      assert.equal(await superaLimite(tx, "login", c, despues(5 * MIN)), false);
      await registrarIntento(tx, "login", c, despues(5 * MIN));
      assert.equal(await superaLimite(tx, "login", c, despues(5 * MIN)), true);
    }));

  test("el bloqueo termina cuando los intentos salen de la ventana de 15 minutos", () =>
    enTransaccion(async (tx) => {
      const c = claveHmac(`b-${marca()}`, "s");
      for (let i = 0; i < 6; i++) await registrarIntento(tx, "login", c, despues(i * MIN));
      assert.equal(await superaLimite(tx, "login", c, despues(14 * MIN)), true);
      assert.equal(await superaLimite(tx, "login", c, despues(15 * MIN + 30 * 1000)), false);
    }));

  test("intentos espaciados (menos de 6 por ventana) no superan el límite", () =>
    enTransaccion(async (tx) => {
      const c = claveHmac(`c-${marca()}`, "s");
      for (let i = 0; i < 8; i++) await registrarIntento(tx, "login", c, despues(i * 4 * MIN));
      assert.equal(await superaLimite(tx, "login", c, despues(8 * 4 * MIN)), false);
    }));

  test("claves distintas son independientes", () =>
    enTransaccion(async (tx) => {
      const [a, b] = [claveHmac(`d-${marca()}`, "s"), claveHmac(`e-${marca()}`, "s")];
      for (let i = 0; i < 6; i++) await registrarIntento(tx, "login", a, despues(i * MIN));
      assert.equal(await superaLimite(tx, "login", a, despues(6 * MIN)), true);
      assert.equal(await superaLimite(tx, "login", b, despues(6 * MIN)), false);
    }));

  test("el tipo formulario no cuenta para el login de la misma clave", () =>
    enTransaccion(async (tx) => {
      const c = claveHmac(`f-${marca()}`, "s");
      for (let i = 0; i < 6; i++) await registrarIntento(tx, "formulario", c, despues(i * MIN));
      assert.equal(await superaLimite(tx, "login", c, despues(6 * MIN)), false);
    }));

  test("limpiarIntentos borra solo los de esa clave y tipo", () =>
    enTransaccion(async (tx) => {
      const [a, b] = [claveHmac(`g-${marca()}`, "s"), claveHmac(`h-${marca()}`, "s")];
      for (let i = 0; i < 6; i++) await registrarIntento(tx, "login", a, despues(i * MIN));
      await registrarIntento(tx, "login", b, despues(0));
      await limpiarIntentos(tx, "login", a);
      assert.equal(await superaLimite(tx, "login", a, despues(6 * MIN)), false);
      assert.equal((await tx.select().from(intentosLimitados).where(eq(intentosLimitados.clave, a))).length, 0);
      assert.equal((await tx.select().from(intentosLimitados).where(eq(intentosLimitados.clave, b))).length, 1);
    }));
});

describe("clave por IP (IPv6 por prefijo /64)", () => {
  test("direcciones del mismo /64 comparten clave; otro /64 o IPv4 no", () => {
    assert.equal(claveDeIp("2001:db8:abcd:12::1", "s"), claveDeIp("2001:db8:abcd:12:ffff:eeee:dddd:cccc", "s"));
    assert.equal(claveDeIp("2001:DB8:ABCD:0012:1:2:3:4", "s"), claveDeIp("2001:db8:abcd:12::99", "s"));
    assert.notEqual(claveDeIp("2001:db8:abcd:12::1", "s"), claveDeIp("2001:db8:abcd:13::1", "s"));
    assert.notEqual(claveDeIp("2001:db8:abcd:12::1", "s"), claveDeIp("203.0.113.5", "s"));
  });

  test("prefijoIpv6 normaliza y rechaza lo que no es IPv6", () => {
    assert.equal(prefijoIpv6("2001:db8::1"), "2001:0db8:0000:0000::/64");
    assert.equal(prefijoIpv6("::1"), "0000:0000:0000:0000::/64");
    assert.equal(prefijoIpv6("[2001:db8:1:2::5]"), "2001:0db8:0001:0002::/64");
    assert.equal(prefijoIpv6("203.0.113.5"), null);
    assert.equal(prefijoIpv6("::ffff:203.0.113.5"), null);
    assert.equal(prefijoIpv6("no-es-ip"), null);
  });

  test("una IPv4 sigue contando por dirección exacta y el primer valor de la lista manda", () => {
    assert.notEqual(claveDeIp("203.0.113.5", "s"), claveDeIp("203.0.113.6", "s"));
    assert.equal(claveDeIp("203.0.113.5, 10.0.0.1", "s"), claveDeIp("203.0.113.5", "s"));
  });
});

describe("formulario: contarIntentos y ventana", () => {
  test("cuenta solo los de la última hora", () =>
    enTransaccion(async (tx) => {
      const c = claveHmac(`i-${marca()}`, "s");
      await registrarIntento(tx, "formulario", c, despues(0));
      await registrarIntento(tx, "formulario", c, despues(30 * MIN));
      assert.equal(await contarIntentos(tx, "formulario", c, despues(59 * MIN)), 2);
      assert.equal(await contarIntentos(tx, "formulario", c, despues(61 * MIN)), 1);
    }));

  test("los límites declarados son los de la spec", () => {
    assert.deepEqual(LIMITES.login, { ventanaMs: 15 * MIN, maximo: 5 });
    assert.deepEqual(LIMITES.formulario, { ventanaMs: 60 * MIN, maximo: 5 });
  });
});

describe("limpieza y tabla", () => {
  test("registrar borra los intentos de más del doble de la ventana", () =>
    enTransaccion(async (tx) => {
      const viejo = claveHmac(`j-${marca()}`, "s");
      await registrarIntento(tx, "login", viejo, despues(0));
      await registrarIntento(tx, "login", claveHmac(`k-${marca()}`, "s"), despues(31 * MIN));
      assert.equal((await tx.select().from(intentosLimitados).where(eq(intentosLimitados.clave, viejo))).length, 0);
    }));

  test("la tabla solo guarda tipo, clave y fecha: ningún valor legible", () =>
    enTransaccion(async (tx) => {
      const c = claveHmac("rosa@correo.test", "s");
      await registrarIntento(tx, "login", c, despues(0));
      const [fila] = await tx.select().from(intentosLimitados).where(eq(intentosLimitados.clave, c));
      assert.deepEqual(Object.keys(fila).sort(), ["clave", "creadoEn", "id", "tipo"]);
      assert.ok(!JSON.stringify(fila).includes("rosa"));
    }));

  test("un tipo inválido lo rechaza la base", () =>
    enTransaccion(async (tx) => {
      const r = await rechazo(tx, (t) => t.insert(intentosLimitados).values({ tipo: "otro" as never, clave: "x" }));
      assert.equal(r.code, "23514");
    }));
});
