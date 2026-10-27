import Link from "next/link";
import { getAvanceProyectos, listarProyectos } from "@/lib/private-queries";
import { oAlLogin } from "@/lib/zona-privada";
import { AVANCE_VACIO } from "@/lib/avance-consulta";
import { BloqueSinAsignar, ResumenAvance } from "./avance";

// ADR 0005: sin caché; cada visita lee la base.
export const dynamic = "force-dynamic";

export const metadata = { title: "Proyectos – ONG La FAZ" };

export default async function ProyectosPage() {
  const [proyectos, avance] = await oAlLogin(() => Promise.all([listarProyectos(), getAvanceProyectos()]));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
        <Link href="/proyectos/nuevo" className="rounded bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
          Nuevo proyecto
        </Link>
      </div>
      <BloqueSinAsignar sinAsignar={avance.sinAsignar} />
      <ul className="divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {proyectos.map((p) => (
          <li key={p.id}>
            <Link href={`/proyectos/${p.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900">
              <span className="flex items-center justify-between gap-4">
                <span className="font-medium">{p.nombre}</span>
                <span className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                  {p.tieneMeta ? `${p.cantidadItems} ítem${p.cantidadItems === 1 ? "" : "s"}` : "Informativo"}
                  <span className={p.estado === "finalizado" ? "rounded bg-zinc-200 px-2 py-0.5 dark:bg-zinc-800" : "rounded bg-green-100 px-2 py-0.5 text-green-800 dark:bg-green-900 dark:text-green-100"}>
                    {p.estado === "finalizado" ? "Finalizado" : "Activo"}
                  </span>
                </span>
              </span>
              <ResumenAvance avance={avance.proyectos[p.id] ?? AVANCE_VACIO} compacto />
            </Link>
          </li>
        ))}
        {proyectos.length === 0 && <li className="px-4 py-6 text-center text-zinc-600 dark:text-zinc-400">Todavía no hay proyectos.</li>}
      </ul>
      <Link href="/panel" className="text-sm underline">← Panel</Link>
    </main>
  );
}
