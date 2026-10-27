import Link from "next/link";
import { getDatosFormularioDonacion, getDonacionParaVincular } from "@/lib/private-queries";
import { oAlLogin } from "@/lib/zona-privada";
import { registrarDonacionAccion } from "../actions";
import { FormularioDonacion } from "./formulario";

// ADR 0005: sin caché; cada visita lee la base.
export const dynamic = "force-dynamic";

export const metadata = { title: "Registrar donación – ONG La FAZ" };

const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function NuevaDonacionPage(props: PageProps<"/donaciones/nueva">) {
  const parametros = await props.searchParams;
  const datos = await oAlLogin(() => getDatosFormularioDonacion());

  // Segundo paso de una donación mixta: ?vinculada=<id> precarga donante, tipo opuesto, fecha y proyecto.
  const pedida = primero(parametros.vinculada);
  const candidata = pedida ? await oAlLogin(() => getDonacionParaVincular(/^\d+$/.test(pedida) ? Number(pedida) : Number.NaN)) : null;
  const vinculada = candidata?.puedeVincularse ? candidata : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Registrar donación</h1>
      {pedida && !vinculada && (
        <p role="alert" className="text-sm text-amber-800 dark:text-amber-300">
          No se puede registrar la otra parte de esa donación (no existe, está anulada o ya forma parte de una donación mixta). Se muestra el formulario normal.
        </p>
      )}
      <FormularioDonacion accion={registrarDonacionAccion} datos={datos} vinculada={vinculada} />
      <Link href="/panel" className="text-sm underline">← Panel</Link>
    </main>
  );
}
