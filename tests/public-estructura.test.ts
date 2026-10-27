import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const RAIZ = join(import.meta.dirname, "..");
const PUBLICO = join(RAIZ, "app", "(publico)");
const PROYECTOS = join(PUBLICO, "nuestros-proyectos");
const sinComentarios = (s: string) => s.replace(/^\s*\/\/.*$/gm, "");
const leer = (ruta: string) => readFileSync(ruta, "utf8");

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}
const fuentesPublicas = () => archivos(PUBLICO).filter((f) => /\.(ts|tsx)$/.test(f));
const fuentes = (dir: string) => archivos(dir).filter((f) => /\.(ts|tsx)$/.test(f));
const MODULOS = [join(RAIZ, "lib", "public-queries-core.ts"), join(RAIZ, "lib", "public-queries.ts")];

describe("ADR 0007: la zona pública lee solo por lib/public-queries", () => {
  test("ningún archivo público importa la base, el esquema, drizzle, Auth.js ni lo privado", () => {
    const PROHIBIDO =
      /from\s+["'](?:@\/|(?:\.\.?\/)+)(?:lib\/)?(?:db|db-client|schema|auth|avance-consulta|reporte-consulta|private-[\w-]+)["']|from\s+["'](?:drizzle-orm|@neondatabase|next-auth|@auth)|\(privado\)/;
    assert.deepEqual(fuentesPublicas().filter((f) => PROHIBIDO.test(sinComentarios(leer(f)))), []);
  });

  test("el módulo público no lee apoyantes, no escribe y no usa caché", () => {
    for (const m of MODULOS) {
      const codigo = sinComentarios(leer(m));
      assert.doesNotMatch(codigo, /apoyantes|voluntariosInscritos|responsables|\.insert\(|\.update\(|\.delete\(|\.execute\(/, m);
      assert.doesNotMatch(codigo, /use cache|revalidate|unstable_cache|cacheLife|cacheTag/, m);
    }
  });

  test("el tipo de salida pública no tiene campos de dinero, costo ni personas", () => {
    const tipos = sinComentarios(leer(MODULOS[0])).match(/export type ItemPublico[\s\S]*?\n};\n\nexport type ProyectoPublico[\s\S]*?\n};/)?.[0] ?? "";
    assert.ok(tipos.length > 0, "no se encontró el tipo");
    assert.doesNotMatch(tipos, /dinero|monto|soles|costo|apoyante|contacto|donante|sinAsignar|registrado|excedente/i);
  });

  test("el módulo usa la función de avance compartida y la regla de vigente, sin copiar sus filtros", () => {
    const codigo = sinComentarios(leer(MODULOS[0]));
    assert.match(codigo, /consultarAvance\(/);
    assert.doesNotMatch(codigo, /anulada|donaciones\b/);
  });

  test("el tope de la meta se aplica solo al presentar, dentro del módulo público", () => {
    assert.match(sinComentarios(leer(MODULOS[0])), /Math\.min\(i\.recibido, i\.meta\)/);
    assert.doesNotMatch(sinComentarios(leer(join(RAIZ, "lib", "avance.ts"))), /Math\.min\(100/);
  });

  test("lib/public-queries.ts es server-only", () => {
    assert.match(leer(MODULOS[1]), /import "server-only"/);
    assert.doesNotMatch(leer(MODULOS[0]), /server-only|next\//);
  });
});

describe("ADR 0011: la zona pública lee solo con el rol de solo lectura", () => {
  const DB_PUBLICO = join(RAIZ, "lib", "db-publico.ts");

  test("lib/public-queries.ts obtiene la base solo por db-publico, nunca por getDb", () => {
    const codigo = sinComentarios(leer(MODULOS[1]));
    assert.match(codigo, /from\s+["']\.\/db-publico["']/);
    assert.match(codigo, /getDbPublico\(\)/);
    assert.doesNotMatch(codigo, /db-client|getDb\(|getPool|DATABASE_URL\b(?!_)/);
  });

  test("cada lectura pública comprueba antes que la conexión es el rol de solo lectura", () => {
    const codigo = sinComentarios(leer(MODULOS[1]));
    assert.match(codigo, /from\s+["']\.\/rol-publico["']/);
    for (const nombre of ["listarProyectosPublicos", "getProyectoPublico"]) {
      const cuerpo = codigo.match(new RegExp(`export async function ${nombre}\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}`))?.[0] ?? "";
      assert.ok(cuerpo.length > 0, `no se encontró ${nombre}`);
      assert.match(cuerpo, /await asegurarRolPublico\(\)/, nombre);
      assert.ok(cuerpo.indexOf("asegurarRolPublico") < cuerpo.indexOf("return lecturas."), nombre);
    }
    assert.match(codigo, /comprobarRolPublico\(getDbPublico\(\)\)/);
  });

  test("db-publico lee DATABASE_URL_PUBLICO y no cae a la conexión de la aplicación", () => {
    const codigo = sinComentarios(leer(DB_PUBLICO));
    assert.match(codigo, /process\.env\.DATABASE_URL_PUBLICO/);
    assert.doesNotMatch(codigo, /process\.env\.DATABASE_URL(?!_PUBLICO)|db-client|\?\?|\|\|/);
    assert.match(leer(DB_PUBLICO), /import "server-only"/);
  });

  test("solo las lecturas públicas importan db-publico", () => {
    const todos = [...fuentes(join(RAIZ, "lib")), ...fuentes(join(RAIZ, "app"))];
    const usan = todos.filter((f) => /from\s+["'](?:@\/lib\/|\.\/|(?:\.\.\/)+lib\/)db-publico["']/.test(leer(f)));
    assert.deepEqual(usan.map((f) => f.replace(RAIZ + "/", "")), ["lib/public-queries.ts"]);
  });

  test("la inscripción de voluntariado y lo privado no usan la conexión pública", () => {
    for (const ruta of ["voluntariado-inscripcion.ts", "voluntariado-inscripcion-core.ts", "private-queries.ts", "escritura-auditada.ts"]) {
      assert.doesNotMatch(leer(join(RAIZ, "lib", ruta)), /db-publico/, ruta);
    }
  });
});

describe("ADR 0005: sin caché y con error visible", () => {
  test("la lista y el detalle son dinámicos y sin caché", () => {
    for (const p of ["page.tsx", join("[id]", "page.tsx")]) {
      const src = leer(join(PROYECTOS, p));
      assert.match(src, /export const dynamic = "force-dynamic"/, p);
      assert.doesNotMatch(src, /use cache|revalidate|unstable_cache/, p);
    }
  });

  test("existe error.tsx, no muestra el error ni sus datos, y ofrece reintentar", () => {
    const ruta = join(PROYECTOS, "error.tsx");
    assert.ok(existsSync(ruta));
    const src = sinComentarios(leer(ruta));
    assert.match(src, /^"use client"/);
    assert.match(src, /reset/);
    assert.doesNotMatch(src.replace(/console\.error\([^)]*\)/, ""), /error\.message|error\.stack|error\.digest|\{error\}/);
  });

  test("una página que lee la base no atrapa el error para mostrar cero", () => {
    for (const f of archivos(PROYECTOS).filter((f) => /page\.tsx$/.test(f))) {
      assert.doesNotMatch(sinComentarios(leer(f)), /\bcatch\b|\.catch\(/, f);
    }
  });

  test("el detalle usa notFound() y hay not-found.tsx", () => {
    assert.match(leer(join(PROYECTOS, "[id]", "page.tsx")), /notFound\(\)/);
    assert.ok(existsSync(join(PROYECTOS, "not-found.tsx")));
  });
});

describe("rutas y presentación", () => {
  test("la ruta pública no choca con la privada /proyectos", () => {
    assert.ok(existsSync(join(RAIZ, "app", "(privado)", "proyectos", "page.tsx")));
    assert.ok(!existsSync(join(PUBLICO, "proyectos")));
    assert.ok(existsSync(join(PROYECTOS, "page.tsx")));
  });

  test("las páginas de proyectos no tienen formularios ni botones de pago y no muestran dinero", () => {
    for (const f of archivos(PROYECTOS).filter((f) => !/error\.tsx$/.test(f) && /\.tsx$/.test(f))) {
      const src = sinComentarios(leer(f));
      assert.doesNotMatch(src, /<form|<input|<button|S\/\s|formatearSoles|totalDinero|faltaSoles/, f);
    }
  });

  test("solo los proyectos activos con meta invitan a donar", () => {
    const detalle = leer(join(PROYECTOS, "[id]", "page.tsx"));
    assert.match(detalle, /activoConMeta &&/);
    assert.match(detalle, /href="\/como-donar"/);
  });

  test("la barra es accesible: progressbar con valores y texto 'Meta cumplida'", () => {
    const barra = leer(join(PUBLICO, "_componentes", "barra-publica.tsx"));
    assert.match(barra, /role="progressbar"/);
    assert.match(barra, /aria-valuenow/);
    assert.match(barra, /Meta cumplida/);
  });

  test("Cómo donar remite a los proyectos", () => {
    assert.match(leer(join(PUBLICO, "como-donar", "page.tsx")), /DONACION_PRODUCTOS\.enlaceHref/);
  });

  test("el formulario privado avisa que descripción y resultado son públicos", () => {
    const f = leer(join(RAIZ, "app", "(privado)", "proyectos", "formularios.tsx"));
    assert.match(f, /Descripción[^"]*Se muestra en la web pública/);
    assert.match(f, /Resultado del proyecto[^"]*Se muestra en la web pública/);
  });
});
