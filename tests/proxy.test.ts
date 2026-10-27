import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { redirigirSinSesion } from "../lib/proxy-redireccion";

describe("proxy: redirección al login", () => {
  test("sin sesión redirige a /login", () => {
    const res = redirigirSinSesion(false, new URL("https://lafaz.test/panel"));
    assert.ok(res);
    assert.equal(res.status, 307);
    assert.equal(new URL(res.headers.get("location") ?? "").pathname, "/login");
  });

  test("con sesión deja pasar la petición", () => {
    assert.equal(redirigirSinSesion(true, new URL("https://lafaz.test/panel")), undefined);
  });

  test("el matcher del proxy no cubre la portada ni el login", async () => {
    const fuente = (await import("node:fs")).readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
    const matcher = /matcher:\s*\[([^\]]*)\]/.exec(fuente)?.[1] ?? "";
    assert.match(matcher, /\/panel/);
    assert.match(matcher, /\/proyectos/);
    assert.match(matcher, /\/apoyantes/);
    assert.match(matcher, /\/donaciones/);
    assert.match(matcher, /\/reportes/);
    assert.match(matcher, /\/voluntarios/);
    assert.doesNotMatch(matcher, /"\/"|\/login/);
  });
});
