import Link from "next/link";
import { redirect } from "next/navigation";
import { ResponsableNoActivoError } from "@/lib/private-access";
import { getPanel } from "@/lib/private-queries";
import { cerrarSesion } from "./actions";

// ADR 0005: sin caché; cada visita comprueba al responsable en la base.
export const dynamic = "force-dynamic";

export const metadata = { title: "Panel – ONG La FAZ" };

export default async function PanelPage() {
  let panel;
  try {
    panel = await getPanel();
  } catch (e) {
    if (e instanceof ResponsableNoActivoError) redirect("/login");
    throw e;
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Hola, {panel.nombre}</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">Zona privada de La FAZ</p>
      <div className="mt-6 flex gap-3">
        <Link href="/proyectos" className="rounded bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
          Proyectos
        </Link>
        <Link href="/apoyantes" className="rounded bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
          Apoyantes
        </Link>
        <Link href="/voluntarios" className="rounded bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
          Voluntarios
        </Link>
        <Link href="/donaciones/nueva" className="rounded bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
          Registrar donación
        </Link>
        <Link href="/donaciones" className="rounded bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
          Donaciones
        </Link>
        <Link href="/reportes" className="rounded bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
          Reportes
        </Link>
      </div>
      <form action={cerrarSesion} className="mt-4">
        <button type="submit" className="rounded border border-zinc-300 px-4 py-2 dark:border-zinc-700">
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
