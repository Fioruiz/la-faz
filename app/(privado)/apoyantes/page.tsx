import Link from "next/link";
import { listarApoyantes } from "@/lib/private-queries";
import { oAlLogin } from "@/lib/zona-privada";

// ADR 0005: sin caché; cada visita lee la base.
export const dynamic = "force-dynamic";

export const metadata = { title: "Apoyantes – ONG La FAZ" };

const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ApoyantesPage(props: PageProps<"/apoyantes">) {
  const parametros = await props.searchParams;
  const busqueda = primero(parametros.q).slice(0, 100);
  const rol = ["donante", "voluntario"].includes(primero(parametros.rol)) ? primero(parametros.rol) : "";
  const { filas, total, hayMas } = await oAlLogin(() => listarApoyantes({ busqueda, rol }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Apoyantes</h1>
        <Link href="/apoyantes/nuevo" className="rounded bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
          Nuevo apoyante
        </Link>
      </div>

      <form method="get" action="/apoyantes" className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-1 flex-col gap-1">
          Buscar por nombre
          <input name="q" defaultValue={busqueda} maxLength={100} className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
        </label>
        <label className="flex flex-col gap-1">
          Rol
          <select name="rol" defaultValue={rol} className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
            <option value="">Todos</option>
            <option value="donante">Donantes</option>
            <option value="voluntario">Voluntarios</option>
          </select>
        </label>
        <button type="submit" className="rounded border border-zinc-300 px-4 py-2 dark:border-zinc-700">Buscar</button>
      </form>

      <ul className="divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {filas.map((a) => (
          <li key={a.id}>
            <Link href={`/apoyantes/${a.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900">
              <span className="font-medium">{a.nombre}</span>
              <span className="flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                {a.esDonante && <span className="rounded bg-zinc-200 px-2 py-0.5 dark:bg-zinc-800">Donante</span>}
                {a.esVoluntario && <span className="rounded bg-zinc-200 px-2 py-0.5 dark:bg-zinc-800">Voluntario</span>}
                {a.anonimoPublico && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-900 dark:text-amber-100">Anónimo en lo público</span>}
              </span>
            </Link>
          </li>
        ))}
        {filas.length === 0 && (
          <li className="px-4 py-6 text-center text-zinc-600 dark:text-zinc-400">
            {busqueda || rol ? "No hay resultados para esa búsqueda." : "Todavía no hay apoyantes."}
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
