import Link from "next/link";
import { getPanel } from "@/lib/private-queries";
import { oAlLogin } from "@/lib/zona-privada";
import { crearApoyanteAccion } from "../actions";
import { FormularioApoyante } from "../formularios";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nuevo apoyante – ONG La FAZ" };

export default async function NuevoApoyantePage() {
  // No lee datos de negocio, pero exige un responsable activo antes de mostrar el formulario.
  await oAlLogin(() => getPanel());

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Nuevo apoyante</h1>
      <FormularioApoyante accion={crearApoyanteAccion} />
      <Link href="/apoyantes" className="text-sm underline">← Apoyantes</Link>
    </main>
  );
}
