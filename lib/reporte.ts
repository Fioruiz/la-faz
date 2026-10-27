import { aCentimos, deCentimos, sumar } from "./dinero";
import { esFechaValida } from "./fechas";

// Cálculo puro del reporte (#10): arma los grupos desde filas ya agregadas en SQL. Sin Next ni base. El dinero
// va en céntimos (BigInt); los productos se agrupan por ítem y NUNCA se suman unidades distintas entre sí.

export const FECHA_MINIMA_REPORTE = "2020-01-01";

export type FilaDinero = { responsableId: number; proyectoId: number | null; medio: string | null; total: string; cantidad: number };
export type FilaProducto = { responsableId: number; proyectoId: number | null; itemId: number | null; cantidad: number; donaciones: number };
export type FilaAnulada = { responsableId: number; proyectoId: number | null; cantidad: number };

export type EntradaReporte = {
  dinero: FilaDinero[];
  productos: FilaProducto[];
  anuladas: FilaAnulada[];
  responsables: { id: number; nombre: string; activo: boolean }[];
  proyectos: { id: number; nombre: string; estado: string }[];
  items: { id: number; nombre: string; unidad: string; proyectoId: number }[];
};

export type Dinero = {
  total: string;
  // Siempre suman el total: el dinero sin medio (no debería ocurrir, pero la base lo permite) va a `sinMedio`.
  porMedio: { yape: string; plin: string; transferencia: string; sinMedio: string };
  donaciones: number;
};
export type ProductoItem = { itemId: number; nombre: string; unidad: string; proyecto: string; cantidad: number; donaciones: number };
export type Productos = { items: ProductoItem[]; sinAsignar: { donaciones: number } };

export type Grupo = {
  id: number | null;
  nombre: string;
  desactivado: boolean; // responsable desactivado
  finalizado: boolean; // proyecto finalizado
  donaciones: number; // vigentes: dinero + producto
  dinero: Dinero;
  productos: Productos;
  anuladas: number;
};

export type Reporte = {
  porResponsable: Grupo[];
  porProyecto: Grupo[];
  total: Omit<Grupo, "id" | "nombre" | "desactivado" | "finalizado">;
};

const CERO = BigInt(0);
type Acumulador = { dinero: Record<"yape" | "plin" | "transferencia" | "sinMedio", bigint>; donacionesDinero: number; items: Map<number, { cantidad: number; donaciones: number }>; sinAsignar: number; anuladas: number };
const nuevo = (): Acumulador => ({ dinero: { yape: CERO, plin: CERO, transferencia: CERO, sinMedio: CERO }, donacionesDinero: 0, items: new Map(), sinAsignar: 0, anuladas: 0 });

function claveMedio(medio: string | null): "yape" | "plin" | "transferencia" | "sinMedio" {
  return medio === "yape" || medio === "plin" || medio === "transferencia" ? medio : "sinMedio";
}

function cerrar(a: Acumulador, entrada: EntradaReporte) {
  const todos = Object.values(a.dinero);
  const dinero: Dinero = {
    total: deCentimos(sumar(todos)),
    porMedio: { yape: deCentimos(a.dinero.yape), plin: deCentimos(a.dinero.plin), transferencia: deCentimos(a.dinero.transferencia), sinMedio: deCentimos(a.dinero.sinMedio) },
    donaciones: a.donacionesDinero,
  };
  const items: ProductoItem[] = [...a.items.entries()]
    .map(([itemId, v]) => {
      const item = entrada.items.find((i) => i.id === itemId);
      const proyecto = entrada.proyectos.find((p) => p.id === item?.proyectoId);
      return { itemId, nombre: item?.nombre ?? `Ítem ${itemId}`, unidad: item?.unidad ?? "", proyecto: proyecto?.nombre ?? "", cantidad: v.cantidad, donaciones: v.donaciones };
    })
    .sort((x, y) => x.proyecto.localeCompare(y.proyecto, "es") || x.nombre.localeCompare(y.nombre, "es"));
  const donacionesProducto = items.reduce((n, i) => n + i.donaciones, 0) + a.sinAsignar;
  return { donaciones: dinero.donaciones + donacionesProducto, dinero, productos: { items, sinAsignar: { donaciones: a.sinAsignar } }, anuladas: a.anuladas };
}

function agrupar(entrada: EntradaReporte, clave: (f: { responsableId: number; proyectoId: number | null }) => number | null) {
  const grupos = new Map<number | null, Acumulador>();
  const de = (k: number | null) => grupos.get(k) ?? grupos.set(k, nuevo()).get(k)!;
  for (const f of entrada.dinero) {
    const g = de(clave(f));
    g.dinero[claveMedio(f.medio)] += aCentimos(f.total);
    g.donacionesDinero += f.cantidad;
  }
  for (const f of entrada.productos) {
    const g = de(clave(f));
    if (f.itemId === null) g.sinAsignar += f.donaciones;
    else {
      const actual = g.items.get(f.itemId) ?? { cantidad: 0, donaciones: 0 };
      g.items.set(f.itemId, { cantidad: actual.cantidad + f.cantidad, donaciones: actual.donaciones + f.donaciones });
    }
  }
  for (const f of entrada.anuladas) de(clave(f)).anuladas += f.cantidad;
  return grupos;
}

const totalCentimos = (g: Grupo) => aCentimos(g.dinero.total);
const porTotal = (a: Grupo, b: Grupo) => (totalCentimos(a) === totalCentimos(b) ? a.nombre.localeCompare(b.nombre, "es") : totalCentimos(a) > totalCentimos(b) ? -1 : 1);

export function armarReporte(entrada: EntradaReporte): Reporte {
  const construir = (clave: Parameters<typeof agrupar>[1], describir: (k: number | null) => Pick<Grupo, "nombre" | "desactivado" | "finalizado">): Grupo[] =>
    [...agrupar(entrada, clave).entries()]
      .map(([id, a]) => ({ id, ...describir(id), ...cerrar(a, entrada) }))
      .filter((g) => g.donaciones > 0 || g.anuladas > 0) // sin donaciones (ni anuladas) en el rango, no hay grupo
      .sort(porTotal);

  const porResponsable = construir(
    (f) => f.responsableId,
    (id) => {
      const r = entrada.responsables.find((x) => x.id === id);
      return { nombre: r?.nombre ?? `Responsable ${id}`, desactivado: r ? !r.activo : false, finalizado: false };
    },
  );
  const porProyecto = construir(
    (f) => f.proyectoId,
    (id) => {
      if (id === null) return { nombre: "Sin asignar", desactivado: false, finalizado: false };
      const p = entrada.proyectos.find((x) => x.id === id);
      return { nombre: p?.nombre ?? `Proyecto ${id}`, desactivado: false, finalizado: p?.estado === "finalizado" };
    },
  );
  // Total general: todas las filas en un solo grupo (la clave da igual), para que cuadre con ambas vistas.
  const total = cerrar(agrupar(entrada, () => 0).get(0) ?? nuevo(), entrada);
  return { porResponsable, porProyecto, total };
}

// ---- Rango de fechas ----

export type RangoValido = { ok: true; desde?: string; hasta?: string } | { ok: false; error: string };

function masUnAnio(hoy: string): string {
  const [a, m, d] = hoy.split("-").map(Number);
  return new Date(Date.UTC(a + 1, m - 1, d)).toISOString().slice(0, 10);
}

// Vacío o ausente = sin límite. `hasta` admite hasta un año adelante de hoy para poder pedir "todo noviembre" a
// mitad de mes; `desde` no puede ser anterior a 2020-01-01. Inclusivo en ambos extremos.
export function validarRango(desdeTexto: string | undefined, hastaTexto: string | undefined, hoy: string): RangoValido {
  const desde = desdeTexto?.trim() || undefined;
  const hasta = hastaTexto?.trim() || undefined;
  for (const [nombre, valor] of [["desde", desde], ["hasta", hasta]] as const) {
    if (valor !== undefined && !esFechaValida(valor)) return { ok: false, error: `La fecha «${nombre}» no es válida: usa el formato AAAA-MM-DD` };
  }
  if (desde !== undefined && desde < FECHA_MINIMA_REPORTE) return { ok: false, error: `La fecha «desde» no puede ser anterior a ${FECHA_MINIMA_REPORTE}` };
  const tope = masUnAnio(hoy);
  if (hasta !== undefined && hasta > tope) return { ok: false, error: `La fecha «hasta» no puede pasar de ${tope}` };
  if (desde !== undefined && hasta !== undefined && desde > hasta) return { ok: false, error: "«Desde» no puede ser posterior a «hasta»" };
  return { ok: true, desde, hasta };
}
