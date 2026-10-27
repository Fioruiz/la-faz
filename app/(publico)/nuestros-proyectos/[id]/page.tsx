import Link from "next/link";
import { notFound } from "next/navigation";
import { getProyectoPublico } from "@/lib/public-queries";
import { BarraPublica } from "../../_componentes/barra-publica";

// ADR 0005: sin caché; cada visita consulta la base.
export const dynamic = "force-dynamic";

const idDe = (texto: string) => (/^\d{1,10}$/.test(texto) ? Number(texto) : NaN);

export async function generateMetadata({ params }: PageProps<"/nuestros-proyectos/[id]">) {
  const proyecto = await getProyectoPublico(idDe((await params).id));
  return {
    title: `${proyecto?.nombre ?? "Proyecto"} – ONG La FAZ`,
    description: proyecto?.descripcion ?? "Proyecto de La FAZ.",
  };
}

export default async function ProyectoPublicoPage({ params }: PageProps<"/nuestros-proyectos/[id]">) {
  const proyecto = await getProyectoPublico(idDe((await params).id));
  if (!proyecto) notFound();
  const activoConMeta = proyecto.conMeta && proyecto.estado === "activo";

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <p>
        <Link href="/nuestros-proyectos" className="font-semibold text-marca underline underline-offset-4">
          ← Proyectos
        </Link>
      </p>
      {proyecto.estado === "finalizado" && (
        <p className="mt-6 inline-block rounded-full bg-marca-suave px-3 py-0.5 text-sm font-semibold text-marca">
          Finalizado
        </p>
      )}
      <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">{proyecto.nombre}</h1>
      {proyecto.descripcion && <p className="mt-4 max-w-2xl">{proyecto.descripcion}</p>}

      {proyecto.estado === "finalizado" && proyecto.resultado && (
        <section aria-labelledby="resultado" className="mt-8 rounded-2xl border border-publico-borde bg-publico-tarjeta p-6">
          <h2 id="resultado" className="text-xl font-bold">
            Resultado
          </h2>
          <p className="mt-2">{proyecto.resultado}</p>
        </section>
      )}

      {proyecto.conMeta && proyecto.items.length > 0 && (
        <section aria-labelledby="que-donar" className="mt-10">
          <h2 id="que-donar" className="text-xl font-bold">
            {activoConMeta ? "Qué se puede donar" : "Metas del proyecto"}
          </h2>
          <ul className="mt-5 space-y-6">
            {proyecto.items.map((item) => (
              <li key={item.id} className="rounded-2xl border border-publico-borde bg-publico-tarjeta p-5">
                <BarraPublica item={item} />
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm font-semibold">
            {proyecto.metasCumplidas} de {proyecto.metasTotal}{" "}
            {proyecto.metasTotal === 1 ? "meta cumplida" : "metas cumplidas"}
          </p>
        </section>
      )}

      {proyecto.conMeta && proyecto.items.length === 0 && (
        <p role="note" className="mt-8 rounded-2xl border-2 border-marca bg-marca-suave p-5">
          Pronto publicaremos qué se necesita en este proyecto.
        </p>
      )}

      {activoConMeta && (
        <p className="mt-8">
          <Link
            href="/como-donar"
            className="inline-block rounded-xl bg-marca px-6 py-3 text-base font-semibold text-marca-texto hover:opacity-90"
          >
            Cómo donar
          </Link>
        </p>
      )}
    </div>
  );
}
