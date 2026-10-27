import Link from "next/link";
import { notFound } from "next/navigation";
import { getProyecto } from "@/lib/private-queries";
import { oAlLogin } from "@/lib/zona-privada";
import {
  crearItemAccion,
  editarItemAccion,
  editarProyectoAccion,
  finalizarProyectoAccion,
} from "../actions";
import { BarraAvance, BloqueSinAsignar, ResumenAvance } from "../avance";
import { FormularioFinalizar, FormularioItem, FormularioProyecto } from "../formularios";

// ADR 0005: sin caché; cada visita lee la base.
export const dynamic = "force-dynamic";

const soles = (costo: string) => `S/ ${Number(costo).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;

export default async function ProyectoPage(props: PageProps<"/proyectos/[id]">) {
  const { id } = await props.params;
  const proyecto = await oAlLogin(() => getProyecto(/^\d+$/.test(id) ? Number(id) : Number.NaN));
  if (!proyecto) notFound();

  const activo = proyecto.estado === "activo";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {proyecto.nombre}{" "}
          <span className="ml-2 align-middle text-sm font-normal text-zinc-600 dark:text-zinc-400">
            {activo ? "Activo" : "Finalizado"} · {proyecto.tieneMeta ? "Con meta" : "Informativo"}
          </span>
        </h1>
        {proyecto.descripcion && <p className="text-zinc-600 dark:text-zinc-400">{proyecto.descripcion}</p>}
      </div>

      {activo ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Datos del proyecto</h2>
          <FormularioProyecto accion={editarProyectoAccion} proyecto={proyecto} />
        </section>
      ) : (
        <section className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Resultado</h2>
          <p className="mt-2 whitespace-pre-wrap">{proyecto.resultado}</p>
        </section>
      )}

      <section className="flex flex-col gap-3" aria-label="Avance">
        <h2 className="text-lg font-semibold">Avance{activo ? "" : " final"}</h2>
        <ResumenAvance avance={proyecto.avance} />
        {proyecto.tieneMeta && proyecto.avance.items.length > 0 && (
          <div className="flex flex-col gap-4">
            {proyecto.avance.items.map((item) => (
              <BarraAvance key={item.id} item={item} />
            ))}
          </div>
        )}
        <BloqueSinAsignar sinAsignar={proyecto.sinAsignar} />
      </section>

      {proyecto.tieneMeta && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Ítems con meta</h2>
          {proyecto.items.length === 0 && <p className="text-zinc-600 dark:text-zinc-400">Todavía no hay ítems.</p>}
          <ul className="flex flex-col gap-2">
            {proyecto.items.map((item) => (
              <li key={item.id} className="rounded border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <details>
                  <summary className="flex cursor-pointer items-center justify-between gap-4">
                    <span className="font-medium">{item.nombre}</span>
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      Meta: {item.cantidadMeta.toLocaleString("es-PE")} {item.unidad}
                      {item.costoReferencial ? ` · ${soles(item.costoReferencial)} por unidad` : ""}
                    </span>
                  </summary>
                  {activo && (
                    <div className="mt-4">
                      <FormularioItem accion={editarItemAccion} proyectoId={proyecto.id} item={item} />
                    </div>
                  )}
                </details>
              </li>
            ))}
          </ul>
          {activo && (
            <details className="rounded border border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <summary className="cursor-pointer font-medium">Agregar ítem</summary>
              <div className="mt-4">
                <FormularioItem accion={crearItemAccion} proyectoId={proyecto.id} />
              </div>
            </details>
          )}
        </section>
      )}

      {activo && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Finalizar proyecto</h2>
          <FormularioFinalizar accion={finalizarProyectoAccion} proyectoId={proyecto.id} />
        </section>
      )}

      <Link href="/proyectos" className="text-sm underline">← Proyectos</Link>
    </main>
  );
}
