import Link from "next/link";
import { notFound } from "next/navigation";
import { getApoyante } from "@/lib/private-queries";
import { oAlLogin } from "@/lib/zona-privada";
import { editarApoyanteAccion } from "../actions";
import { FormularioApoyante } from "../formularios";

// ADR 0005: sin caché; cada visita lee la base.
export const dynamic = "force-dynamic";

export const metadata = { title: "Apoyante – ONG La FAZ" };

export default async function ApoyantePage(props: PageProps<"/apoyantes/[id]">) {
  const { id } = await props.params;
  const apoyante = await oAlLogin(() => getApoyante(/^\d+$/.test(id) ? Number(id) : Number.NaN));
  if (!apoyante) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{apoyante.nombre}</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Donaciones registradas: {apoyante.cantidadDonaciones} · Inscripciones de voluntariado: {apoyante.cantidadInscripciones}
      </p>
      <FormularioApoyante accion={editarApoyanteAccion} apoyante={apoyante} />
      <Link href="/apoyantes" className="text-sm underline">← Apoyantes</Link>
    </main>
  );
}
