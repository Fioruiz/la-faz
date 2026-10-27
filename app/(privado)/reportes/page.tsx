import Link from "next/link";
import { getReporte } from "@/lib/private-queries";
import { oAlLogin } from "@/lib/zona-privada";
import { TarjetaGrupo } from "./grupo";

// ADR 0005: sin caché; cada visita lee la base. El reporte se consulta en pantalla: no se exporta (PRD: No alcance).
export const dynamic = "force-dynamic";

export const metadata = { title: "Reportes – ONG La FAZ" };

const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ReportesPage(props: PageProps<"/reportes">) {
  const parametros = await props.searchParams;
  const desde = primero(parametros.desde).slice(0, 10);
  const hasta = primero(parametros.hasta).slice(0, 10);
  const resultado = await oAlLogin(() => getReporte({ desde, hasta }));
  const conRango = desde !== "" || hasta !== "";

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>

      <form method="get" action="/reportes" className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Desde
          <input type="date" name="desde" defaultValue={desde} className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
        </label>
        <label className="flex flex-col gap-1">
          Hasta
          <input type="date" name="hasta" defaultValue={hasta} className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
        </label>
        <button type="submit" className="rounded bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">Ver</button>
        {conRango && <Link href="/reportes" className="py-2 underline">Quitar rango</Link>}
      </form>
      <p className="-mt-4 text-xs text-zinc-600 dark:text-zinc-400">
        Las fechas son las de recepción de cada donación. Las donaciones anuladas no cuentan en los totales.
      </p>

      {!resultado.ok ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">{resultado.error}</p>
      ) : resultado.reporte.total.donaciones === 0 && resultado.reporte.total.anuladas === 0 ? (
        <p role="status" className="text-zinc-600 dark:text-zinc-400">No hay donaciones{conRango ? " en ese rango" : ""}.</p>
      ) : (
        <>
          <section aria-label="Totales generales" className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Total general</h2>
            <TarjetaGrupo titulo="Todas las donaciones" grupo={resultado.reporte.total} mostrarProyecto />
          </section>

          <section aria-label="Por responsable" className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Por responsable</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Quién registró cada donación, sin importar el proyecto.</p>
            {resultado.reporte.porResponsable.map((g) => (
              <TarjetaGrupo key={g.id} titulo={g.nombre} grupo={g} mostrarProyecto etiquetas={g.desactivado ? ["Desactivado"] : []} />
            ))}
          </section>

          <section aria-label="Por proyecto" className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Por proyecto</h2>
            {resultado.reporte.porProyecto.map((g) => (
              <TarjetaGrupo key={g.id ?? "sin-asignar"} titulo={g.nombre} grupo={g} etiquetas={g.finalizado ? ["Finalizado"] : []} />
            ))}
          </section>
        </>
      )}
      <Link href="/panel" className="text-sm underline">← Panel</Link>
    </main>
  );
}
