import Link from "next/link";
import { listarDonaciones } from "@/lib/private-queries";
import { oAlLogin } from "@/lib/zona-privada";

// ADR 0005: sin caché; cada visita lee la base.
export const dynamic = "force-dynamic";

export const metadata = { title: "Donaciones – ONG La FAZ" };

const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const FILTROS = [
  ["todas", "Todas"],
  ["sin-asignar", "Sin asignar"],
  ["anuladas", "Anuladas"],
] as const;

const soles = (monto: string) => `S/ ${Number(monto).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;

export default async function DonacionesPage(props: PageProps<"/donaciones">) {
  const parametros = await props.searchParams;
  const busqueda = primero(parametros.q).slice(0, 100);
  const filtro = FILTROS.some(([valor]) => valor === primero(parametros.filtro)) ? primero(parametros.filtro) : "todas";
  const { filas, total, hayMas } = await oAlLogin(() => listarDonaciones({ filtro, busqueda }));
  const enlace = (f: string) => `/donaciones?filtro=${f}${busqueda ? `&q=${encodeURIComponent(busqueda)}` : ""}`;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Donaciones</h1>
        <Link href="/donaciones/nueva" className="rounded bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
          Registrar donación
        </Link>
      </div>

      <nav className="flex gap-2 text-sm" aria-label="Filtro">
        {FILTROS.map(([valor, etiqueta]) => (
          <Link
            key={valor}
            href={enlace(valor)}
            aria-current={filtro === valor ? "page" : undefined}
            className={`rounded border px-3 py-1 ${filtro === valor ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-300 dark:border-zinc-700"}`}
          >
            {etiqueta}
          </Link>
        ))}
      </nav>

      <form method="get" action="/donaciones" className="flex items-end gap-3 text-sm">
        <input type="hidden" name="filtro" value={filtro} />
        <label className="flex flex-1 flex-col gap-1">
          Buscar por donante
          <input name="q" defaultValue={busqueda} maxLength={100} className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
        </label>
        <button type="submit" className="rounded border border-zinc-300 px-4 py-2 dark:border-zinc-700">Buscar</button>
      </form>

      <ul className="divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {filas.map((f) => (
          <li key={f.id}>
            <Link href={`/donaciones/${f.id}`} className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 ${f.anulada ? "text-zinc-500 line-through decoration-zinc-400" : ""}`}>
              <span className="flex flex-col">
                <span className="font-medium">{f.donanteNombre}</span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {f.fecha} · {f.proyectoNombre ?? "Sin asignar"}
                  {f.itemNombre ? ` · ${f.itemNombre}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2 text-sm">
                {f.tipo === "dinero" ? soles(f.monto ?? "0") + (f.medio ? ` (${f.medio})` : "") : `${f.cantidad ?? 0} ${f.itemUnidad ?? "unid."}${f.descripcion ? ` · ${f.descripcion}` : ""}`}
                {f.esParteMixta && <span className="rounded bg-zinc-200 px-2 py-0.5 dark:bg-zinc-800">Mixta</span>}
                {f.anulada && <span className="rounded bg-red-100 px-2 py-0.5 text-red-800 no-underline dark:bg-red-900 dark:text-red-100">Anulada</span>}
                {!f.anulada && f.proyectoId === null && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-900 dark:text-amber-100">Sin asignar</span>}
              </span>
            </Link>
          </li>
        ))}
        {filas.length === 0 && (
          <li className="px-4 py-6 text-center text-zinc-600 dark:text-zinc-400">
            {busqueda || filtro !== "todas" ? "No hay donaciones para esa búsqueda." : "Todavía no hay donaciones."}
          </li>
        )}
      </ul>
      {hayMas && (
        <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
          Hay {total} coincidencias y se muestran las primeras {filas.length}. Acota la búsqueda para ver el resto.
        </p>
      )}
      <Link href="/panel" className="text-sm underline">← Panel</Link>
    </main>
  );
}
