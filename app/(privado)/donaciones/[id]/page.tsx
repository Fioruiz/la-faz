import Link from "next/link";
import { notFound } from "next/navigation";
import { getDonacion } from "@/lib/private-queries";
import { oAlLogin } from "@/lib/zona-privada";
import { anularDonacionAccion, asignarDonacionAccion, editarDonacionAccion } from "../actions";
import { FormularioAnularDonacion, FormularioAsignarDonacion, FormularioEditarDonacion } from "./formularios";

// ADR 0005: sin caché; cada visita lee la base.
export const dynamic = "force-dynamic";

export const metadata = { title: "Donación – ONG La FAZ" };

const soles = (monto: string) => `S/ ${Number(monto).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;

export default async function DonacionPage(props: PageProps<"/donaciones/[id]">) {
  const { id } = await props.params;
  const d = await oAlLogin(() => getDonacion(/^\d+$/.test(id) ? Number(id) : Number.NaN));
  if (!d) notFound();

  const resumen = d.tipo === "dinero" ? `${soles(d.monto ?? "0")}${d.medio ? ` por ${d.medio}` : ""}` : `${d.cantidad ?? 0} ${d.itemUnidad ?? "unidades"}`;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Donación #{d.id} {d.anulada && <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-sm text-red-800 dark:bg-red-900 dark:text-red-100">Anulada</span>}
        </h1>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-zinc-600 dark:text-zinc-400">Donante</dt><dd>{d.donanteNombre}</dd>
          <dt className="text-zinc-600 dark:text-zinc-400">Tipo</dt><dd>{d.tipo === "dinero" ? "Dinero" : "Producto"}: {resumen}</dd>
          <dt className="text-zinc-600 dark:text-zinc-400">Proyecto</dt><dd>{d.proyectoNombre ?? "Sin asignar"}{d.itemNombre ? ` · ${d.itemNombre}` : ""}</dd>
          {d.descripcion && (<><dt className="text-zinc-600 dark:text-zinc-400">Descripción</dt><dd>{d.descripcion}</dd></>)}
          <dt className="text-zinc-600 dark:text-zinc-400">Fecha</dt><dd>{d.fecha}</dd>
          <dt className="text-zinc-600 dark:text-zinc-400">Registrada por</dt><dd>{d.registradoPorNombre}</dd>
        </dl>
        {d.pareja && (
          <p className="text-sm">
            Donación mixta: la otra parte es la <Link href={`/donaciones/${d.pareja.id}`} className="underline">donación #{d.pareja.id} ({d.pareja.tipo})</Link>.
          </p>
        )}
      </div>

      {d.soloLectura ? (
        <p role="status" className="rounded border border-zinc-300 p-4 text-sm dark:border-zinc-700">{d.razonSoloLectura}</p>
      ) : (
        <>
          {d.proyectoId === null && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">Asignar a un proyecto</h2>
              <FormularioAsignarDonacion accion={asignarDonacionAccion} donacion={d} proyectos={d.proyectosDestino} />
            </section>
          )}
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Corregir datos</h2>
            {/* La clave reinicia el formulario cuando cambian los datos guardados (asignar o editar): si no, conservaría el proyecto anterior y al guardar lo desharía. */}
            <FormularioEditarDonacion
              key={JSON.stringify([d.proyectoId, d.itemId, d.monto, d.medio, d.cantidad, d.descripcion, d.fecha])}
              accion={editarDonacionAccion}
              donacion={d}
              proyectos={d.proyectosDestino}
            />
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Anular</h2>
            <FormularioAnularDonacion accion={anularDonacionAccion} donacionId={d.id} />
          </section>
        </>
      )}

      <Link href="/donaciones" className="text-sm underline">← Donaciones</Link>
    </main>
  );
}
