import Link from "next/link";
import { listarProyectosPublicos } from "@/lib/public-queries";

// ADR 0005: sin caché; cada visita consulta la base.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Proyectos – ONG La FAZ",
  description: "Conoce los proyectos de La FAZ, qué se necesita en cada uno y cuánto se lleva recibido.",
};

export default async function ProyectosPublicosPage() {
  const proyectos = await listarProyectosPublicos();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:py-16">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Proyectos</h1>
      <p className="mt-3 max-w-3xl">
        Estos son los proyectos de La FAZ. En los que tienen meta puedes ver qué se necesita y cuánto se lleva recibido.
      </p>

      {proyectos.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-publico-borde bg-publico-tarjeta p-6">
          Pronto publicaremos aquí nuestros proyectos.
        </p>
      ) : (
        <ul className="mt-10 grid gap-6 md:grid-cols-2">
          {proyectos.map((p) => (
            <li key={p.id} className="flex flex-col rounded-2xl border border-publico-borde bg-publico-tarjeta p-6">
              {p.estado === "finalizado" && (
                <p className="mb-2 inline-block self-start rounded-full bg-marca-suave px-3 py-0.5 text-sm font-semibold text-marca">
                  Finalizado
                </p>
              )}
              <h2 className="text-xl font-bold">{p.nombre}</h2>
              {p.descripcion && <p className="mt-2 text-publico-apagado">{p.descripcion}</p>}
              {p.conMeta && p.metasTotal > 0 && (
                <p className="mt-3 text-sm font-semibold">
                  {p.metasCumplidas} de {p.metasTotal} {p.metasTotal === 1 ? "meta cumplida" : "metas cumplidas"}
                </p>
              )}
              <p className="mt-4">
                <Link href={`/nuestros-proyectos/${p.id}`} className="font-semibold text-marca underline underline-offset-4">
                  {p.conMeta && p.estado === "activo" && p.items.length > 0 ? "Ver qué se puede donar" : "Ver proyecto"}
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
