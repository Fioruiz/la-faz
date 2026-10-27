"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Campo, Mensajes, boton, entrada, useCampos, type Accion } from "../formulario-comun";

type ApoyanteForm = {
  id: number;
  nombre: string;
  contacto: string | null;
  esDonante: boolean;
  esVoluntario: boolean;
  anonimoPublico: boolean;
};

export function FormularioApoyante({ accion, apoyante }: { accion: Accion; apoyante?: ApoyanteForm }) {
  const [estado, enviar, pendiente] = useActionState(accion, null);
  const router = useRouter();
  const campos = useCampos(estado);

  useEffect(() => {
    if (!estado?.ok) return;
    if (apoyante) router.refresh();
    else router.push(`/apoyantes/${estado.datos.id}`);
  }, [estado, apoyante, router]);

  const errorRoles = campos.error("roles");

  return (
    <form action={enviar} className="flex w-full max-w-md flex-col gap-4 text-left">
      {apoyante && <input type="hidden" name="apoyanteId" value={apoyante.id} />}
      <Campo etiqueta="Nombre" error={campos.error("nombre")}>
        <input name="nombre" required maxLength={100} defaultValue={campos.valor("nombre", apoyante?.nombre)} className={entrada} />
      </Campo>
      <Campo etiqueta="Contacto (teléfono o correo, opcional)" error={campos.error("contacto")}>
        <input name="contacto" maxLength={200} defaultValue={campos.valor("contacto", apoyante?.contacto)} className={entrada} />
      </Campo>
      <p className="-mt-2 text-xs text-zinc-600 dark:text-zinc-400">
        El contacto solo se ve aquí: no aparece en la lista ni en el historial.
      </p>
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1">Rol</legend>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="esDonante" defaultChecked={campos.marcada("esDonante", apoyante?.esDonante ?? true)} />
          Donante
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="esVoluntario" defaultChecked={campos.marcada("esVoluntario", apoyante?.esVoluntario ?? false)} />
          Voluntario
        </label>
        {errorRoles && <span role="alert" className="text-red-700 dark:text-red-400">{errorRoles}</span>}
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="anonimoPublico" defaultChecked={campos.marcada("anonimoPublico", apoyante?.anonimoPublico ?? false)} />
        Anónimo en lo público (se mostrará como «Anónimo»)
      </label>
      <Mensajes estado={estado} exito={apoyante ? "Cambios guardados" : undefined} />
      <button type="submit" disabled={pendiente} className={boton}>
        {pendiente ? "Guardando…" : apoyante ? "Guardar cambios" : "Crear apoyante"}
      </button>
    </form>
  );
}
