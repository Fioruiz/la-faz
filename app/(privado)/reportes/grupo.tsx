import Link from "next/link";
import type { Grupo } from "@/lib/reporte";
import { formatearCantidad, formatearSoles } from "@/lib/formato";

// Solo presenta: todo viene calculado de lib/reporte.ts. Sin nombres ni contactos de donantes.
type DatosGrupo = Pick<Grupo, "donaciones" | "dinero" | "productos" | "anuladas">;

export function TarjetaGrupo({
  titulo,
  grupo,
  mostrarProyecto = false,
  etiquetas = [],
}: {
  titulo: string;
  grupo: DatosGrupo;
  mostrarProyecto?: boolean;
  etiquetas?: string[];
}) {
  const { dinero, productos } = grupo;
  const medios = [
    ["Yape", dinero.porMedio.yape],
    ["Plin", dinero.porMedio.plin],
    ["Transferencia", dinero.porMedio.transferencia],
    ...(dinero.porMedio.sinMedio !== "0.00" ? [["Sin medio", dinero.porMedio.sinMedio]] : []),
  ];
  const hayProductos = productos.items.length > 0 || productos.sinAsignar.donaciones > 0;
  return (
    <article className="flex flex-col gap-3 rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">{titulo}</h3>
        <span className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          {etiquetas.map((e) => (
            <span key={e} className="rounded bg-zinc-200 px-2 py-0.5 dark:bg-zinc-800">{e}</span>
          ))}
          {grupo.donaciones} {grupo.donaciones === 1 ? "donación vigente" : "donaciones vigentes"}
        </span>
      </header>

      <section aria-label="Dinero" className="text-sm">
        <p className="font-medium">Dinero: {formatearSoles(dinero.total)}</p>
        <p className="text-zinc-600 dark:text-zinc-400">{medios.map(([medio, monto]) => `${medio} ${formatearSoles(monto)}`).join(" · ")}</p>
      </section>

      {hayProductos && (
        <section aria-label="Productos" className="text-sm">
          <p className="font-medium">Productos</p>
          <ul className="text-zinc-600 dark:text-zinc-400">
            {productos.items.map((i) => (
              <li key={i.itemId}>
                {mostrarProyecto && i.proyecto ? `${i.proyecto} · ` : ""}
                {i.nombre}: {formatearCantidad(i.cantidad)} {i.unidad} ({i.donaciones} {i.donaciones === 1 ? "donación" : "donaciones"})
              </li>
            ))}
            {productos.sinAsignar.donaciones > 0 && (
              <li>Productos sin asignar: {productos.sinAsignar.donaciones} {productos.sinAsignar.donaciones === 1 ? "donación" : "donaciones"}</li>
            )}
          </ul>
        </section>
      )}

      {grupo.anuladas > 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {grupo.anuladas} {grupo.anuladas === 1 ? "anulada" : "anuladas"}, fuera de estos totales.{" "}
          <Link href="/donaciones?filtro=anuladas" className="underline">Ver anuladas</Link>
        </p>
      )}
    </article>
  );
}
