import Link from "next/link";
import { listarVoluntarios } from "@/lib/private-queries";
import { oAlLogin } from "@/lib/zona-privada";

// ADR 0005: sin caché; cada visita lee la base.
export const dynamic = "force-dynamic";

export const metadata = { title: "Voluntarios – ONG La FAZ" };

const fecha = (d: Date) =>
  new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" }).format(d);

export default async function VoluntariosPage() {
  const { filas, total, hayMas } = await oAlLogin(() => listarVoluntarios());

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Voluntarios inscritos</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Inscripciones del formulario público. El contacto se ve en el detalle de cada persona.
      </p>

      <ul className="divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {filas.map((v) => (
          <li key={v.id}>
            <Link href={`/apoyantes/${v.apoyanteId}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900">
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{v.nombre}</span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">{fecha(v.creadoEn)}</span>
              </span>
              {/* El mensaje lo escribe el visitante: se muestra siempre como texto. */}
              {v.mensaje && <span className="whitespace-pre-line text-sm">{v.mensaje}</span>}
            </Link>
          </li>
        ))}
        {filas.length === 0 && (
          <li className="px-4 py-6 text-center text-zinc-600 dark:text-zinc-400">Todavía no hay voluntarios inscritos.</li>
        )}
      </ul>
      {hayMas && (
        <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
          Hay {total} inscripciones y se muestran las {filas.length} más recientes.
        </p>
      )}
      <Link href="/panel" className="text-sm underline">← Panel</Link>
    </main>
  );
}
