import { formatearCantidad } from "@/lib/formato";
import type { ItemPublico } from "@/lib/public-queries";

// Solo presenta: las cantidades llegan ya limitadas a la meta desde lib/public-queries. El estado no depende
// solo del color: el texto dice cuánto se lleva y si la meta está cumplida.
export function BarraPublica({ item }: { item: ItemPublico }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-lg font-semibold">{item.nombre}</p>
        <p>
          <span className="font-semibold">{formatearCantidad(item.recibido)}</span> de {formatearCantidad(item.meta)}{" "}
          {item.unidad}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label={`Avance de ${item.nombre}`}
        aria-valuemin={0}
        aria-valuemax={item.meta}
        aria-valuenow={item.recibido}
        aria-valuetext={`${item.recibido} de ${item.meta} ${item.unidad}`}
        className="mt-2 h-4 w-full overflow-hidden rounded-full bg-publico-borde"
      >
        <div className="h-full rounded-full bg-marca" style={{ width: `${item.porcentaje}%` }} />
      </div>
      {item.cumplida && <p className="mt-1 text-sm font-semibold text-marca">Meta cumplida</p>}
    </div>
  );
}
