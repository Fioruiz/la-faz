import { aCentimos, deCentimos, maximoCero, sumar } from "./dinero";

// ÚNICA definición de "lo recibido" y "lo que falta" (cierra A2). Puro: no toca la base ni Next. La zona
// privada la usa ya; la pública (#12) la usará igual y solo añadirá el tope del 100% al presentar.
// Sin contadores guardados: todo se deriva de lo agregado en cada lectura (ADR 0002 y 0008).

export type ItemAgregado = {
  id: number;
  proyectoId: number;
  nombre: string;
  unidad: string;
  cantidadMeta: number;
  costoReferencial: string | null; // numeric como texto: "13.00"
  recibido: number; // SUM(cantidad) de producto no anulado con este ítem
};

export type EntradaAvance = {
  proyectoIds: number[];
  items: ItemAgregado[];
  dineroPorProyecto: Record<number, string>; // SUM(monto) de dinero no anulado, como texto
  sinAsignar: { totalDinero: string; cantidad: number };
};

export type AvanceItem = {
  id: number;
  nombre: string;
  unidad: string;
  meta: number;
  recibido: number;
  porcentaje: number; // real, hacia abajo, sin tope (107 si recibió 2150 de 2000)
  excedente: number;
  falta: number;
  cumplida: boolean;
  costoReferencial: string | null;
};

// "completa": todos los ítems tienen costo. "parcial": hay ítems sin costo (literal del ADR 0010).
// "no-disponible": ningún ítem tiene costo (o no hay ítems): no se estima, no se muestra "S/ 0".
export type Estimacion = "completa" | "parcial" | "no-disponible";

// Sin porcentaje del proyecto: mezclaría unidades distintas (decisión del usuario sobre A3).
export type AvanceProyecto = {
  items: AvanceItem[];
  metasTotal: number;
  metasCumplidas: number;
  totalDinero: string;
  faltaSoles: string | null;
  estimacion: Estimacion;
};

export type ResultadoAvance = {
  proyectos: Record<number, AvanceProyecto>;
  sinAsignar: { totalDinero: string; cantidad: number };
};

export function calcularItem(item: ItemAgregado): AvanceItem {
  const { cantidadMeta: meta, recibido } = item;
  return {
    id: item.id,
    nombre: item.nombre,
    unidad: item.unidad,
    meta,
    recibido,
    porcentaje: meta > 0 ? Math.floor((recibido * 100) / meta) : 0,
    excedente: Math.max(0, recibido - meta),
    falta: Math.max(0, meta - recibido),
    cumplida: recibido >= meta,
    costoReferencial: item.costoReferencial,
  };
}

// falta_soles = max(0, Σ ítems con costo (max(0, meta − recibido) × costo) − dinero del proyecto).
// El excedente de un ítem NO compensa lo que falta de otro: cada ítem aporta su propio max(0, …).
export function calcularProyecto(items: AvanceItem[], totalDinero: string): AvanceProyecto {
  const conCosto = items.filter((i) => i.costoReferencial !== null);
  const costoDeLoQueFalta = sumar(conCosto.map((i) => BigInt(i.falta) * aCentimos(i.costoReferencial as string)));
  const estimacion: Estimacion = conCosto.length === 0 ? "no-disponible" : conCosto.length < items.length ? "parcial" : "completa";
  return {
    items,
    metasTotal: items.length,
    metasCumplidas: items.filter((i) => i.cumplida).length,
    totalDinero: deCentimos(aCentimos(totalDinero)),
    faltaSoles: estimacion === "no-disponible" ? null : deCentimos(maximoCero(costoDeLoQueFalta - aCentimos(totalDinero))),
    estimacion,
  };
}

export function calcularAvance(entrada: EntradaAvance): ResultadoAvance {
  const proyectos: Record<number, AvanceProyecto> = {};
  for (const proyectoId of entrada.proyectoIds) {
    const items = entrada.items.filter((i) => i.proyectoId === proyectoId).map(calcularItem);
    proyectos[proyectoId] = calcularProyecto(items, entrada.dineroPorProyecto[proyectoId] ?? "0.00");
  }
  return {
    proyectos,
    sinAsignar: { totalDinero: deCentimos(aCentimos(entrada.sinAsignar.totalDinero)), cantidad: entrada.sinAsignar.cantidad },
  };
}
