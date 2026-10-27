import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, test } from "node:test";
import {
  DATOS_LEGALES,
  HITOS,
  MEDIOS_DONACION,
  MENU,
  QUIENES_SOMOS,
  VOLUNTARIOS,
} from "../lib/sitio-contenido";

const RAIZ = join(import.meta.dirname, "..");
const PUBLICO = join(RAIZ, "app", "(publico)");
const PAGINAS = ["page.tsx", "quienes-somos/page.tsx", "como-donar/page.tsx", "voluntariado/page.tsx"];

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}
const leer = (ruta: string) => readFileSync(join(PUBLICO, ruta), "utf8");
// Código sin comentarios de línea, para que un comentario no dispare ni oculte una regla.
const sinComentarios = (s: string) => s.replace(/^\s*\/\/.*$/gm, "");
const fuentesPublicas = () =>
  [...archivos(PUBLICO).filter((f) => /\.(ts|tsx)$/.test(f)), join(RAIZ, "lib", "sitio-contenido.ts")];

describe("zona pública estática: sin base, sin sesión, sin pagos", () => {
  test("ningún archivo público importa la base, el esquema, drizzle, Auth.js ni lo privado", () => {
    const PROHIBIDO =
      /from\s+["'](?:@\/|(?:\.\.?\/)+)(?:lib\/)?(?:db|db-client|schema|auth|private-[\w-]+|private-access)["']|from\s+["'](?:drizzle-orm|@neondatabase|next-auth|@auth)|\(privado\)/;
    const malos = fuentesPublicas().filter((f) => PROHIBIDO.test(sinComentarios(readFileSync(f, "utf8"))));
    assert.deepEqual(malos, []);
  });

  test("solo las páginas de nuestros-proyectos importan datos, y solo por lib/public-queries", () => {
    const usan = fuentesPublicas().filter((f) => /@\/lib\/public-queries/.test(readFileSync(f, "utf8")));
    const fuera = usan.filter((f) => !f.includes(join("(publico)", "nuestros-proyectos")) && !f.includes("barra-publica"));
    assert.deepEqual(fuera, []);
  });

  test("las páginas estáticas no leen cookies, headers ni searchParams (siguen siendo estáticas)", () => {
    // La Server Action de voluntariado lee x-forwarded-for solo al enviar (para el límite): no vuelve dinámica la página.
    const malos = fuentesPublicas().filter((f) => !f.includes("nuestros-proyectos") && !f.endsWith("voluntariado/actions.ts") &&
      /\b(cookies|headers|searchParams|force-dynamic|unstable_noStore)\b/.test(sinComentarios(readFileSync(f, "utf8"))),
    );
    assert.deepEqual(malos, []);
  });

  test("package.json y el código no traen SDK de pago ni credenciales de bancos", () => {
    const pkg = readFileSync(join(RAIZ, "package.json"), "utf8");
    assert.doesNotMatch(pkg, /stripe|culqi|izipay|mercadopago|paypal|niubiz|payu|openpay/i);
    const codigo = fuentesPublicas().map((f) => readFileSync(f, "utf8")).join("\n");
    assert.doesNotMatch(codigo, /stripe|culqi|izipay|mercadopago|paypal|niubiz|api[_-]?key|secret/i);
  });
});

describe("Cómo donar: demostración y sin cobro", () => {
  const pagina = sinComentarios(leer("como-donar/page.tsx"));

  test("no tiene formularios, campos ni botones, ni enlaces a servicios de pago", () => {
    assert.doesNotMatch(pagina, /<form|<input|<button|<select|<textarea|type=["']submit/i);
    assert.doesNotMatch(pagina, /href=\{?["']https?:/);
    for (const f of archivos(join(PUBLICO, "_componentes")).filter((f) => /aviso-simulacion/.test(f))) {
      assert.doesNotMatch(readFileSync(f, "utf8"), /<form|<input|<button/i);
    }
  });

  test("el aviso de simulación aparece antes de los medios y cada medio trae su etiqueta", () => {
    assert.ok(pagina.indexOf("<AvisoSimulacion") !== -1);
    assert.ok(pagina.indexOf("<AvisoSimulacion") < pagina.indexOf("MEDIOS_DONACION.map"));
    assert.match(pagina, /AVISO_SIMULACION\.etiquetaMedio/);
  });

  test("hay cuatro medios: Yape, Plin, transferencia nacional e internacional", () => {
    assert.deepEqual(MEDIOS_DONACION.map((m) => m.id), ["yape", "plin", "transferencia", "internacional"]);
  });

  test("los datos de cuenta son de relleno: solo ceros, o la palabra demostración / DEMO", () => {
    const numericos = /^(Número|Cuenta en soles|CCI|Cuenta)$/;
    for (const medio of MEDIOS_DONACION) {
      for (const d of medio.datos) {
        if (numericos.test(d.etiqueta)) {
          assert.doesNotMatch(d.valor, /[1-9]/, `${medio.id} ${d.etiqueta} debe ser de relleno`);
        }
        if (d.etiqueta === "Titular") assert.match(d.valor, /demostración/i);
        if (d.etiqueta === "Banco") assert.match(d.valor, /demostración/i);
        if (d.etiqueta === "SWIFT") assert.match(d.valor, /^DEMO/);
      }
    }
  });

  test("no ofrece recibos ni deducciones tributarias", () => {
    const texto = JSON.stringify(MEDIOS_DONACION) + pagina;
    assert.doesNotMatch(texto, /recibo|deducib|deducci|tributari/i);
  });

  test("el acceso desde el inicio no presenta la donación como disponible para cobro", () => {
    const inicio = sinComentarios(leer("page.tsx"));
    assert.doesNotMatch(inicio, /<form|<input|<button|donar ahora|pagar/i);
  });
});

describe("contenido aportado por la ONG", () => {
  test("Quiénes somos: titular y tres párrafos, con la ubicación confirmada", () => {
    assert.equal(QUIENES_SOMOS.titular, "Nacimos de un amor que se convierte en acción.");
    assert.equal(QUIENES_SOMOS.parrafos.length, 3);
    assert.match(QUIENES_SOMOS.parrafos[2], /Ventanilla \(Callao\), Chepén e Ica/);
    assert.match(VOLUNTARIOS.texto, /Ventanilla \(Callao\), Chepén e Ica/);
    assert.doesNotMatch(JSON.stringify([QUIENES_SOMOS, VOLUNTARIOS]), /Ica\/Chepén|Ventanilla, Lima/);
  });

  test("la historia tiene cinco hitos en el orden aportado", () => {
    assert.deepEqual(HITOS.map((h) => h.anio), ["2004", "2004", "2004 - 2024", "2025", "2026"]);
    for (const h of HITOS) {
      assert.ok(h.frase.length > 0 && h.descripcion.length > 0);
    }
  });

  test("la línea de tiempo es una lista ordenada y la sección tiene el ancla #historia", () => {
    assert.match(leer("_componentes/linea-de-tiempo.tsx"), /<ol/);
    assert.match(leer("quienes-somos/page.tsx"), /id="historia"/);
  });

  test("el bloque de voluntarios y su botón llevan a una página existente", () => {
    assert.equal(VOLUNTARIOS.boton, "Ser voluntario");
    assert.equal(VOLUNTARIOS.href, "/voluntariado");
    assert.ok(existsSync(join(PUBLICO, "voluntariado", "page.tsx")));
  });

  test("solo voluntariado/ tiene formulario público (#13); las demás páginas siguen sin campos", () => {
    const conFormulario = archivos(PUBLICO)
      .filter((f) => /\.tsx$/.test(f) && /<form[\s>]|<input|<textarea|<select/i.test(sinComentarios(readFileSync(f, "utf8"))))
      .map((f) => relative(PUBLICO, f))
      .sort();
    assert.deepEqual(conFormulario, ["voluntariado/formulario.tsx"]);
    assert.match(sinComentarios(leer("voluntariado/page.tsx")), /<FormularioVoluntariado/);
  });

  test("datos legales completos en el pie", () => {
    assert.equal(DATOS_LEGALES.nombre, "Asociación La Faz");
    assert.equal(
      DATOS_LEGALES.razonSocial,
      "Asociación La Faz – Lineamiento de Apoyo en Fraternidad: Adonai Zarza Ardiente",
    );
    assert.match(DATOS_LEGALES.descripcion, /RUC: 20554014039/);
    assert.match(DATOS_LEGALES.descripcion, /IPREDA/);
    assert.match(DATOS_LEGALES.descripcion, /APCI desde 2025/);
    const pie = leer("_componentes/pie.tsx");
    assert.match(pie, /DATOS_LEGALES\.razonSocial/);
    assert.match(pie, /href="\/login"/);
    assert.match(pie, /Acceso responsables/);
  });
});

describe("navegación, accesibilidad y SEO", () => {
  test("el menú no tiene enlaces rotos e incluye Proyectos en /nuestros-proyectos (no en /proyectos, que es privado)", () => {
    for (const item of MENU) {
      const ruta = item.href === "/" ? "page.tsx" : join(item.href.slice(1), "page.tsx");
      assert.ok(existsSync(join(PUBLICO, ruta)), `${item.href} no tiene página`);
    }
    assert.ok(MENU.some((m) => m.texto === "Proyectos" && m.href === "/nuestros-proyectos"));
    assert.ok(!MENU.some((m) => (m.href as string) === "/proyectos"));
  });

  test("el layout tiene salto al contenido, cabecera, main y pie", () => {
    const layout = leer("layout.tsx");
    assert.match(layout, /href="#contenido"/);
    assert.match(layout, /<Cabecera/);
    assert.match(layout, /<main id="contenido"/);
    assert.match(layout, /<Pie/);
    assert.match(leer("_componentes/cabecera.tsx"), /<nav aria-label=/);
    assert.match(leer("_componentes/cabecera.tsx"), /aria-current/);
    assert.match(leer("_componentes/pie.tsx"), /<footer/);
  });

  test("cada página tiene un solo h1 y un título y descripción propios", () => {
    const titulos = new Set<string>();
    for (const p of PAGINAS) {
      const src = leer(p);
      assert.equal((src.match(/<h1\b/g) ?? []).length, 1, `${p}: un solo h1`);
      const titulo = src.match(/title:\s*"([^"]+)"/)?.[1];
      assert.ok(titulo && /– ONG La FAZ$/.test(titulo), `${p}: título termina en el nombre de la ONG`);
      titulos.add(titulo);
      assert.match(src, /description:\s*\n?\s*"[^"]{20,}"/, `${p}: descripción`);
    }
    assert.equal(titulos.size, PAGINAS.length);
  });

  test("hay estilo de foco visible y el app/page.tsx de 'en construcción' ya no existe", () => {
    assert.match(readFileSync(join(RAIZ, "app", "globals.css"), "utf8"), /focus-visible/);
    assert.ok(!existsSync(join(RAIZ, "app", "page.tsx")));
    assert.doesNotMatch(readFileSync(join(RAIZ, "app", "layout.tsx"), "utf8"), /construcci/i);
  });

  test("las cifras del contenido son solo las aportadas", () => {
    const contenido = sinComentarios(readFileSync(join(RAIZ, "lib", "sitio-contenido.ts"), "utf8"));
    const cifras = new Set(contenido.match(/\d+/g) ?? []);
    const permitidas = /^(2004|2024|2025|2026|21|50|20554014039|0+)$/;
    const raras = [...cifras].filter((c) => !permitidas.test(c));
    assert.deepEqual(raras, []);
  });
});
