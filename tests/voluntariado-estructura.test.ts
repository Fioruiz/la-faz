import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, test } from "node:test";

const RAIZ = join(import.meta.dirname, "..");
const PUBLICO = join(RAIZ, "app", "(publico)");
const VOLUNTARIADO = join(PUBLICO, "voluntariado");
const sinComentarios = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
const leer = (ruta: string) => readFileSync(ruta, "utf8");
const lib = (nombre: string) => join(RAIZ, "lib", nombre);

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}
const fuentes = (dir: string) => archivos(dir).filter((f) => /\.(ts|tsx)$/.test(f));

describe("#13: la inscripción es la única escritura pública", () => {
  test("la única Server Action bajo app/(publico) vive en voluntariado/", () => {
    const acciones = fuentes(PUBLICO)
      .filter((f) => /^\s*["']use server["']/m.test(leer(f)))
      .map((f) => relative(RAIZ, f));
    assert.deepEqual(acciones, ["app/(publico)/voluntariado/actions.ts"]);
  });

  test("la acción solo llama a lib/voluntariado-inscripcion (sin base, esquema ni lo privado)", () => {
    const codigo = sinComentarios(leer(join(VOLUNTARIADO, "actions.ts")));
    assert.match(codigo, /from\s+["']@\/lib\/voluntariado-inscripcion["']/);
    assert.doesNotMatch(codigo, /db-client|@\/lib\/db|schema|drizzle|escritura-auditada["']|private-|\(privado\)|auth/);
  });

  test("el módulo escribe solo apoyantes y voluntariosInscritos, sin historial, sin caché ni lo privado", () => {
    for (const m of ["voluntariado-inscripcion-core.ts", "voluntariado-inscripcion.ts"]) {
      const codigo = sinComentarios(leer(lib(m)));
      assert.doesNotMatch(codigo, /auditLog|registrarAuditoria|escritura-auditada["']|private-|responsables|donaciones|proyectos/, m);
      assert.doesNotMatch(codigo, /use cache|revalidate|unstable_cache|cacheLife|cacheTag/, m);
      assert.doesNotMatch(codigo, /\.update\(|\.delete\(|\.execute\(|\.select\(/, m);
    }
    const nucleo = sinComentarios(leer(lib("voluntariado-inscripcion-core.ts")));
    assert.deepEqual([...nucleo.matchAll(/\.insert\((\w+)\)/g)].map((x) => x[1]).sort(), ["apoyantes", "voluntariosInscritos"]);
    assert.match(leer(lib("voluntariado-inscripcion.ts")), /import "server-only"/);
    assert.doesNotMatch(leer(lib("voluntariado-inscripcion-core.ts")), /server-only|next\//);
  });

  test("el núcleo comprueba el campo trampa antes de validar y fija la versión en el servidor", () => {
    const codigo = sinComentarios(leer(lib("voluntariado-inscripcion-core.ts")));
    assert.ok(codigo.indexOf("CAMPO_TRAMPA]") !== -1 && codigo.indexOf("CAMPO_TRAMPA]") < codigo.indexOf("safeParse"));
    assert.match(codigo, /consentimientoVersion:\s*CONSENTIMIENTO_VOLUNTARIADO\.version/);
    assert.doesNotMatch(sinComentarios(leer(lib("voluntariado-esquemas.ts"))), /version/i);
  });

  test("el límite por IP va primero (antes del campo trampa y de validar) y la IP no se guarda en claro", () => {
    const codigo = sinComentarios(leer(lib("voluntariado-inscripcion-core.ts")));
    const [limite, trampa, validar] = [codigo.indexOf("intentar(db"), codigo.indexOf("CAMPO_TRAMPA]"), codigo.indexOf("safeParse")];
    assert.ok(limite !== -1 && limite < trampa && trampa < validar);
    assert.doesNotMatch(codigo, /x-forwarded-for|headers\(/i);
    const envoltorio = sinComentarios(leer(lib("voluntariado-inscripcion.ts")));
    assert.match(envoltorio, /claveDeIp\(forwardedFor\)/);
    assert.match(sinComentarios(leer(join(VOLUNTARIADO, "actions.ts"))), /headers\(\)\)\.get\("x-forwarded-for"\)/);
  });

  test("las lecturas públicas siguen sin leer apoyantes ni inscripciones", () => {
    for (const m of ["public-queries-core.ts", "public-queries.ts"]) {
      assert.doesNotMatch(sinComentarios(leer(lib(m))), /apoyantes|voluntariosInscritos/, m);
    }
  });

  test("el formulario tiene el campo trampa oculto y no importa base ni lo privado", () => {
    const f = sinComentarios(leer(join(VOLUNTARIADO, "formulario.tsx")));
    assert.match(f, /CAMPO_TRAMPA_NOMBRE/);
    assert.match(f, /aria-hidden="true"/);
    assert.match(f, /tabIndex=\{-1\}/);
    assert.match(f, /autoComplete="off"/);
    assert.doesNotMatch(f, /db-client|schema|drizzle|\(privado\)|private-/);
  });
});

describe("#13: la lista privada de voluntarios", () => {
  const dir = join(RAIZ, "app", "(privado)", "voluntarios");

  test("existe, es dinámica y no usa HTML sin escapar", () => {
    assert.ok(existsSync(join(dir, "page.tsx")));
    for (const f of fuentes(dir)) {
      const codigo = sinComentarios(leer(f));
      assert.doesNotMatch(codigo, /dangerouslySetInnerHTML|innerHTML/, f);
      assert.doesNotMatch(codigo, /db-client|@\/lib\/db|schema|drizzle/, f);
    }
    assert.match(leer(join(dir, "page.tsx")), /export const dynamic = "force-dynamic"/);
  });

  test("la consulta nunca selecciona el contacto", () => {
    const core = sinComentarios(leer(lib("private-queries-core.ts")));
    const consulta = core.match(/async listarVoluntarios\(\)[\s\S]*?\n    },/)?.[0] ?? "";
    assert.ok(consulta.length > 0, "no se encontró la consulta");
    assert.doesNotMatch(consulta, /contacto/);
    assert.match(consulta, /await requerir\(\)/);
  });

  test("el panel y el proxy llevan a /voluntarios", () => {
    assert.match(leer(join(RAIZ, "app", "(privado)", "panel", "page.tsx")), /href="\/voluntarios"/);
    assert.match(leer(join(RAIZ, "proxy.ts")), /\/voluntarios\/:path\*/);
  });
});
