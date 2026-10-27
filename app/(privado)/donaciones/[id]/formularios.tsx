"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Campo, Mensajes, boton, entrada, type Accion } from "../../formulario-comun";

type Proyecto = { id: number; nombre: string; tieneMeta: boolean; items: { id: number; nombre: string; unidad: string }[] };

type DonacionForm = {
  id: number;
  tipo: string;
  monto: string | null;
  medio: string | null;
  cantidad: number | null;
  descripcion: string | null;
  fecha: string;
  proyectoId: number | null;
  itemId: number | null;
};

const MEDIOS = [
  ["yape", "Yape"],
  ["plin", "Plin"],
  ["transferencia", "Transferencia"],
] as const;

// Se envía a mano (sin la prop `action`) para que React NO vacíe el formulario: ante un error o un aviso de
// duplicado se conserva lo escrito, y "Guardar de todos modos" reenvía lo mismo. Tras un éxito, refresca.
function useEnvio(accion: Accion) {
  const [estado, enviar, pendiente] = useActionState(accion, null);
  const formulario = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (estado?.ok) router.refresh();
  }, [estado, router]);
  function enviarFormulario(confirmar: boolean) {
    if (!formulario.current) return;
    const datos = new FormData(formulario.current);
    if (confirmar) datos.set("confirmarDuplicado", "on");
    startTransition(async () => {
      await enviar(datos);
    });
  }
  const errores = estado && !estado.ok && estado.tipo === "validacion" ? estado.errores : {};
  const advertencia = Boolean(estado && !estado.ok && estado.tipo === "advertencia");
  return { estado, pendiente, formulario, enviarFormulario, errores, advertencia };
}

function BotonConfirmar({ visible, pendiente, alConfirmar }: { visible: boolean; pendiente: boolean; alConfirmar: () => void }) {
  if (!visible) return null;
  return (
    <button type="button" disabled={pendiente} onClick={alConfirmar} className="rounded border border-amber-600 px-4 py-2 text-amber-900 dark:text-amber-200">
      Guardar de todos modos
    </button>
  );
}

export function FormularioEditarDonacion({ accion, donacion, proyectos }: { accion: Accion; donacion: DonacionForm; proyectos: Proyecto[] }) {
  const { estado, pendiente, formulario, enviarFormulario, errores, advertencia } = useEnvio(accion);
  const [proyectoId, setProyectoId] = useState(donacion.proyectoId === null ? "sin-asignar" : String(donacion.proyectoId));
  const proyecto = proyectos.find((p) => String(p.id) === proyectoId);
  const esProducto = donacion.tipo === "producto";

  return (
    <form
      ref={formulario}
      onSubmit={(e) => {
        e.preventDefault();
        enviarFormulario(false);
      }}
      className="flex w-full max-w-md flex-col gap-4 text-left"
    >
      <input type="hidden" name="donacionId" value={donacion.id} />
      <Campo etiqueta="Proyecto" error={errores.proyectoId?.[0]}>
        <select name="proyectoId" value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} required className={entrada}>
          {proyectos.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
          <option value="sin-asignar">Sin asignar</option>
        </select>
      </Campo>

      {!esProducto ? (
        <>
          <Campo etiqueta="Monto en soles (S/)" error={errores.monto?.[0]}>
            <input name="monto" required inputMode="decimal" defaultValue={donacion.monto ?? ""} className={entrada} />
          </Campo>
          <Campo etiqueta="Medio" error={errores.medio?.[0]}>
            <select name="medio" required defaultValue={donacion.medio ?? ""} className={entrada}>
              <option value="" disabled>Elige el medio…</option>
              {MEDIOS.map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>{etiqueta}</option>
              ))}
            </select>
          </Campo>
        </>
      ) : (
        <>
          {proyecto && !proyecto.tieneMeta && (
            <p role="alert" className="text-sm text-amber-800 dark:text-amber-300">
              Este proyecto no tiene meta. Elige «Sin asignar» u otro proyecto.
            </p>
          )}
          {proyecto && proyecto.tieneMeta && (
            <Campo etiqueta="Ítem" error={errores.itemId?.[0]}>
              <select name="itemId" required defaultValue={donacion.itemId ?? ""} className={entrada}>
                <option value="" disabled>{proyecto.items.length ? "Elige el ítem…" : "Este proyecto no tiene ítems"}</option>
                {proyecto.items.map((i) => (
                  <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>
                ))}
              </select>
            </Campo>
          )}
          {proyectoId === "sin-asignar" && (
            <Campo etiqueta="¿Qué se recibió?" error={errores.descripcionProducto?.[0]}>
              <input name="descripcionProducto" required maxLength={200} defaultValue={donacion.descripcion ?? ""} className={entrada} />
            </Campo>
          )}
          <Campo etiqueta="Cantidad" error={errores.cantidad?.[0]}>
            <input name="cantidad" required inputMode="numeric" defaultValue={donacion.cantidad ?? ""} className={entrada} />
          </Campo>
        </>
      )}

      <Campo etiqueta="Fecha en que se recibió" error={errores.fecha?.[0]}>
        <input type="date" name="fecha" required defaultValue={donacion.fecha} className={entrada} />
      </Campo>

      <Mensajes estado={estado} exito="Cambios guardados" />
      <BotonConfirmar visible={advertencia} pendiente={pendiente} alConfirmar={() => enviarFormulario(true)} />
      <button type="submit" disabled={pendiente} className={boton}>{pendiente ? "Guardando…" : "Guardar cambios"}</button>
    </form>
  );
}

export function FormularioAsignarDonacion({ accion, donacion, proyectos }: { accion: Accion; donacion: DonacionForm; proyectos: Proyecto[] }) {
  const { estado, pendiente, formulario, enviarFormulario, errores, advertencia } = useEnvio(accion);
  const [proyectoId, setProyectoId] = useState("");
  const proyecto = proyectos.find((p) => String(p.id) === proyectoId);
  const esProducto = donacion.tipo === "producto";

  return (
    <form
      ref={formulario}
      onSubmit={(e) => {
        e.preventDefault();
        enviarFormulario(false);
      }}
      className="flex w-full max-w-md flex-col gap-4 text-left"
    >
      <input type="hidden" name="donacionId" value={donacion.id} />
      <Campo etiqueta="Asignar al proyecto" error={errores.proyectoId?.[0]}>
        <select name="proyectoId" value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} required className={entrada}>
          <option value="" disabled>Elige un proyecto…</option>
          {proyectos.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
      </Campo>
      {esProducto && proyecto && !proyecto.tieneMeta && (
        <p role="alert" className="text-sm text-amber-800 dark:text-amber-300">Este proyecto no tiene meta: crea antes el ítem o elige otro proyecto.</p>
      )}
      {esProducto && proyecto && proyecto.tieneMeta && (
        <Campo etiqueta="Ítem" error={errores.itemId?.[0]}>
          <select name="itemId" required defaultValue="" className={entrada}>
            <option value="" disabled>{proyecto.items.length ? "Elige el ítem…" : "Este proyecto no tiene ítems"}</option>
            {proyecto.items.map((i) => (
              <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>
            ))}
          </select>
        </Campo>
      )}
      <Mensajes estado={estado} exito="Donación asignada" />
      <BotonConfirmar visible={advertencia} pendiente={pendiente} alConfirmar={() => enviarFormulario(true)} />
      <button type="submit" disabled={pendiente} className={boton}>{pendiente ? "Asignando…" : "Asignar"}</button>
    </form>
  );
}

export function FormularioAnularDonacion({ accion, donacionId }: { accion: Accion; donacionId: number }) {
  const { estado, pendiente, formulario, enviarFormulario, errores } = useEnvio(accion);
  return (
    <form
      ref={formulario}
      onSubmit={(e) => {
        e.preventDefault();
        enviarFormulario(false);
      }}
      className="flex w-full max-w-md flex-col gap-3 text-left"
    >
      <input type="hidden" name="donacionId" value={donacionId} />
      <Campo etiqueta="Motivo de la anulación" error={errores.motivo?.[0]}>
        <input name="motivo" required maxLength={200} placeholder="Registrada dos veces por error" className={entrada} />
      </Campo>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        La donación no se borra: queda guardada como anulada, con este motivo en el historial, y no se puede restaurar.
      </p>
      <Mensajes estado={estado} />
      <button type="submit" disabled={pendiente} className="rounded border border-red-700 px-4 py-2 text-red-800 disabled:opacity-60 dark:text-red-300">
        {pendiente ? "Anulando…" : "Anular donación"}
      </button>
    </form>
  );
}
