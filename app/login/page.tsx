import { redirect } from "next/navigation";
import { ResponsableNoActivoError } from "@/lib/private-access";
import { getPanel } from "@/lib/private-queries";
import { FormularioLogin } from "./formulario";

// ADR 0005: sin caché; cada visita lee la sesión.
export const dynamic = "force-dynamic";

export const metadata = { title: "Ingresar – ONG La FAZ" };

export default async function LoginPage() {
  // Quien ya tiene sesión va al panel. Se comprueba en la base: con solo la cookie, un responsable
  // desactivado rebotaría entre /login y /panel sin fin.
  let activo = false;
  try {
    await getPanel();
    activo = true;
  } catch (e) {
    if (!(e instanceof ResponsableNoActivoError)) throw e;
  }
  if (activo) redirect("/panel");

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Ingresar</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">Zona de responsables de La FAZ</p>
      <FormularioLogin />
    </main>
  );
}
