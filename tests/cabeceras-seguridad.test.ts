import assert from "node:assert/strict";
import { describe, test } from "node:test";
import nextConfig, { construirCsp } from "../next.config";

describe("cabeceras de seguridad (ADR 0011)", () => {
  test("se aplican a todas las rutas con las cabeceras esperadas", async () => {
    const reglas = (await nextConfig.headers?.()) ?? [];
    assert.equal(reglas.length, 1);
    assert.equal(reglas[0].source, "/:path*");
    const cab = Object.fromEntries(reglas[0].headers.map((h) => [h.key, h.value]));
    assert.equal(cab["X-Frame-Options"], "DENY");
    assert.equal(cab["X-Content-Type-Options"], "nosniff");
    assert.equal(cab["Referrer-Policy"], "strict-origin-when-cross-origin");
    assert.match(cab["Permissions-Policy"], /camera=\(\).*microphone=\(\).*geolocation=\(\)/);
    assert.ok(cab["Content-Security-Policy"]);
  });

  test("no anuncia el framework", () => {
    assert.equal(nextConfig.poweredByHeader, false);
  });

  test("la CSP de producción no permite eval, orígenes externos ni incrustación", () => {
    const csp = construirCsp(false);
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /form-action 'self'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /base-uri 'self'/);
    assert.doesNotMatch(csp, /unsafe-eval|https?:|ws:|wss:|\*/);
  });

  test("solo en desarrollo se permite eval y websocket", () => {
    const csp = construirCsp(true);
    assert.match(csp, /'unsafe-eval'/);
    assert.match(csp, /ws: wss:/);
    assert.match(csp, /frame-ancestors 'none'/);
  });
});
