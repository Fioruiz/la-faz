"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Campo, Mensajes, boton, entrada, useCampos, type Accion } from "../formulario-comun";

type ProyectoForm = { id: number; nombre: string; descripcion: string | null; tieneMeta: boolean };

export function FormularioProyecto({ accion, proyecto }: { accion: Accion; proyecto?: ProyectoForm }) {
  const [estado, enviar, pendiente] = useActionState(accion, null);
  const router = useRouter();
  const campos = useCampos(estado);

  useEffect(() => {
    if (!estado?.ok) return;
    if (proyecto) router.refresh();
    else router.push(`/proyectos/${estado.datos.id}`);
  }, [estado, proyecto, router]);

  return (
    <form action={enviar} className="flex w-full max-w-md flex-col gap-4 text-left">
      {proyecto && <input type="hidden" name="proyectoId" value={proyecto.id} />}
      <Campo etiqueta="Nombre" error={campos.error("nombre")}>
        <input name="nombre" required maxLength={100} defaultValue={campos.valor("nombre", proyecto?.nombre)} className={entrada} />
      </Campo>
      <Campo etiqueta="Descripción (opcional). Se muestra en la web pública" error={campos.error("descripcion")}>
        <textarea name="descripcion" rows={3} maxLength={1000} defaultValue={campos.valor("descripcion", proyecto?.descripcion)} className={entrada} />
      </Campo>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="tieneMeta" defaultChecked={campos.marcada("tieneMeta", proyecto?.tieneMeta ?? false)} />
        Tiene meta (se podrán definir ítems con cantidad meta)
      </label>
      <Mensajes estado={estado} exito={proyecto ? "Cambios guardados" : undefined} />
      <button type="submit" disabled={pendiente} className={boton}>
        {pendiente ? "Guardando…" : proyecto ? "Guardar cambios" : "Crear proyecto"}
      </button>
    </form>
  );
}

type ItemForm = { id: number; nombre: string; unidad: string; cantidadMeta: number; costoReferencial: string | null };

export function FormularioItem({ accion, proyectoId, item }: { accion: Accion; proyectoId: number; item?: ItemForm }) {
  const [estado, enviar, pendiente] = useActionState(accion, null);
  const router = useRouter();
  const campos = useCampos(estado);

  useEffect(() => {
    if (estado?.ok) router.refresh();
  }, [estado, router]);

  return (
    <form action={enviar} className="flex w-full max-w-md flex-col gap-3 text-left">
      <input type="hidden" name="proyectoId" value={proyectoId} />
      {item && <input type="hidden" name="itemId" value={item.id} />}
      <Campo etiqueta="Nombre del ítem" error={campos.error("nombre")}>
        <input name="nombre" required maxLength={100} defaultValue={campos.valor("nombre", item?.nombre)} className={entrada} />
      </Campo>
      <Campo etiqueta="Unidad (por ejemplo, pack, botella)" error={campos.error("unidad")}>
        <input name="unidad" required maxLength={30} defaultValue={campos.valor("unidad", item?.unidad)} className={entrada} />
      </Campo>
      <Campo etiqueta="Cantidad meta" error={campos.error("cantidadMeta")}>
        <input name="cantidadMeta" required inputMode="numeric" defaultValue={campos.valor("cantidadMeta", item?.cantidadMeta)} className={entrada} />
      </Campo>
      <Campo etiqueta="Costo referencial por unidad, en soles (opcional)" error={campos.error("costoReferencial")}>
        <input name="costoReferencial" inputMode="decimal" placeholder="13,50" defaultValue={campos.valor("costoReferencial", item?.costoReferencial)} className={entrada} />
      </Campo>
      <Mensajes estado={estado} exito={item ? "Cambios guardados" : "Ítem agregado"} />
      <button type="submit" disabled={pendiente} className={boton}>
        {pendiente ? "Guardando…" : item ? "Guardar ítem" : "Agregar ítem"}
      </button>
    </form>
  );
}

export function FormularioFinalizar({ accion, proyectoId }: { accion: Accion; proyectoId: number }) {
  const [estado, enviar, pendiente] = useActionState(accion, null);
  const router = useRouter();
  const campos = useCampos(estado);

  useEffect(() => {
    if (estado?.ok) router.refresh();
  }, [estado, router]);

  return (
    <form action={enviar} className="flex w-full max-w-md flex-col gap-3 text-left">
      <input type="hidden" name="proyectoId" value={proyectoId} />
      <Campo etiqueta="Resultado del proyecto. Se muestra en la web pública" error={campos.error("resultado")}>
        <textarea name="resultado" rows={3} required maxLength={2000} defaultValue={campos.valor("resultado", "")} className={entrada} />
      </Campo>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Al finalizar, el proyecto queda de solo lectura y ya no se puede editar ni reabrir.
      </p>
      <Mensajes estado={estado} />
      <button type="submit" disabled={pendiente} className={boton}>
        {pendiente ? "Finalizando…" : "Finalizar proyecto"}
      </button>
    </form>
  );
}
