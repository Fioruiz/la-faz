import Link from "next/link";
import { getPanel } from "@/lib/private-queries";
import { oAlLogin } from "@/lib/zona-privada";
import { crearProyectoAccion } from "../actions";
import { FormularioProyecto } from "../formularios";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nuevo proyecto – ONG La FAZ" };

export default async function NuevoProyectoPage() {
  // La página no lee datos de negocio, pero sí exige un responsable activo antes de mostrar el formulario.
  await oAlLogin(() => getPanel());

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Nuevo proyecto</h1>
      <FormularioProyecto accion={crearProyectoAccion} />
      <Link href="/proyectos" className="text-sm underline">← Proyectos</Link>
    </main>
  );
}
