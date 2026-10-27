import Link from "next/link";
import type { AvanceItem, AvanceProyecto } from "@/lib/avance";
import { formatearCantidad, formatearSoles } from "@/lib/formato";

// Solo presenta: todo lo que se muestra viene ya calculado de lib/avance.ts (una sola función de avance).

export function BarraAvance({ item }: { item: AvanceItem }) {
  const ancho = Math.min(100, item.porcentaje); // el relleno no pasa del 100%; el texto muestra el real
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className="font-medium">{item.nombre}</span>
        <span>
          {formatearCantidad(item.recibido)} de {formatearCantidad(item.meta)} {item.unidad} · {item.porcentaje}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`Avance de ${item.nombre}`}
        aria-valuemin={0}
        aria-valuemax={item.meta}
        aria-valuenow={item.recibido}
        aria-valuetext={`${item.recibido} de ${item.meta} ${item.unidad}`}
        className="h-3 w-full overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800"
      >
        <div className={`h-full ${item.cumplida ? "bg-green-600" : "bg-blue-600"}`} style={{ width: `${ancho}%` }} />
      </div>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        {item.cumplida ? "Meta cumplida" : `Faltan ${formatearCantidad(item.falta)} ${item.unidad}`}
        {item.excedente > 0 && ` · +${formatearCantidad(item.excedente)} sobre la meta`}
      </p>
    </div>
  );
}

// Resumen sin mezclar unidades: no hay un porcentaje único del proyecto (decisión sobre A3).
export function ResumenAvance({ avance, compacto = false }: { avance: AvanceProyecto; compacto?: boolean }) {
  const hayMetas = avance.metasTotal > 0;
  const hayDinero = avance.totalDinero !== "0.00";
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-1 text-sm ${compacto ? "text-zinc-600 dark:text-zinc-400" : ""}`}>
      {hayMetas && (
        <li>
          {avance.metasCumplidas} de {avance.metasTotal} {avance.metasTotal === 1 ? "meta cumplida" : "metas cumplidas"}
        </li>
      )}
      {(hayDinero || hayMetas) && <li>Recibido en dinero: {formatearSoles(avance.totalDinero)}</li>}
      {hayMetas && avance.estimacion === "no-disponible" && <li>Falta en soles: no se puede estimar (ningún ítem tiene costo de referencia)</li>}
      {hayMetas && avance.faltaSoles !== null && (
        <li>
          Falta en soles: {formatearSoles(avance.faltaSoles)}
          {avance.estimacion === "parcial" && " (estimado parcial: algunos ítems no tienen costo de referencia)"}
        </li>
      )}
    </ul>
  );
}

export function BloqueSinAsignar({ sinAsignar }: { sinAsignar: { totalDinero: string; cantidad: number } }) {
  return (
    <section aria-label="Sin asignar" className="rounded border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950">
      <h2 className="font-semibold">Sin asignar</h2>
      {sinAsignar.cantidad === 0 ? (
        <p className="mt-1">No hay donaciones pendientes de asignar.</p>
      ) : (
        <p className="mt-1">
          {sinAsignar.cantidad} {sinAsignar.cantidad === 1 ? "donación pendiente" : "donaciones pendientes"} de asignar, con {formatearSoles(sinAsignar.totalDinero)} en dinero. No cuentan en ninguna barra.{" "}
          <Link href="/donaciones?filtro=sin-asignar" className="underline">Ver y asignar</Link>
        </p>
      )}
    </section>
  );
}
