"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useRef, useState } from "react";
import { Campo, Mensajes, boton, entrada, type Accion } from "../../formulario-comun";

type DatosRegistro = { id: number; tipo: "dinero" | "producto" };

type Datos = {
  donantes: { id: number; nombre: string; anonimoPublico: boolean }[];
  proyectos: { id: number; nombre: string; tieneMeta: boolean; items: { id: number; nombre: string; unidad: string }[] }[];
  proyectoPorDefectoId: number | null;
  hoy: string;
};

// La segunda parte de una donación mixta: el donante queda fijo y el tipo es el opuesto.
type Vinculada = { id: number; tipo: string; apoyanteId: number; donanteNombre: string; fecha: string; proyectoId: number | null };

const normalizar = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es").trim();
const MEDIOS = [
  ["yape", "Yape"],
  ["plin", "Plin"],
  ["transferencia", "Transferencia"],
] as const;

export function FormularioDonacion({ accion, datos, vinculada }: { accion: Accion<DatosRegistro>; datos: Datos; vinculada: Vinculada | null }) {
  const [estado, enviar, pendiente] = useActionState(accion, null);
  const router = useRouter();
  const formulario = useRef<HTMLFormElement>(null);

  const [tipo, setTipo] = useState(vinculada ? (vinculada.tipo === "dinero" ? "producto" : "dinero") : "dinero");
  const proyectoInicial = vinculada
    ? vinculada.proyectoId !== null && datos.proyectos.some((p) => p.id === vinculada.proyectoId)
      ? String(vinculada.proyectoId)
      : "sin-asignar"
    : datos.proyectoPorDefectoId !== null
      ? String(datos.proyectoPorDefectoId)
      : "";
  const [proyectoId, setProyectoId] = useState(proyectoInicial);
  const [filtro, setFiltro] = useState("");
  const [registrada, setRegistrada] = useState<{ id: number; tipo: string } | null>(null);

  const errores = estado && !estado.ok && estado.tipo === "validacion" ? estado.errores : {};
  const proyecto = datos.proyectos.find((p) => String(p.id) === proyectoId);
  const sinAsignar = proyectoId === "sin-asignar";
  const donantes = datos.donantes.filter((d) => filtro === "" || normalizar(d.nombre).includes(normalizar(filtro)));

  // Se envía a mano (sin la prop `action`) para que React NO vacíe el formulario: ante un error o un
  // aviso de duplicado, lo escrito se conserva y "Guardar de todos modos" reenvía lo mismo.
  function enviarFormulario(confirmar: boolean) {
    if (!formulario.current) return;
    const datosForm = new FormData(formulario.current);
    if (confirmar) datosForm.set("confirmarDuplicado", "on");
    startTransition(async () => {
      await enviar(datosForm);
    });
  }

  if (estado?.ok && (registrada === null || registrada.id !== estado.datos.id)) setRegistrada({ id: estado.datos.id, tipo: estado.datos.tipo });

  if (estado?.ok && registrada) {
    return (
      <div className="flex w-full max-w-md flex-col gap-4 text-left" role="status">
        <h2 className="text-lg font-semibold text-green-700 dark:text-green-400">Donación registrada</h2>
        <p className="text-sm">
          Se guardó la donación #{registrada.id} ({registrada.tipo === "dinero" ? "dinero" : "producto"}).
        </p>
        <div className="flex flex-wrap gap-3">
          {/* Enlace normal a propósito: con <Link> el componente seguiría montado y mostraría la confirmación. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/donaciones/nueva" className={boton}>Registrar otra</a>
          {!vinculada && (
            <a href={`/donaciones/nueva?vinculada=${registrada.id}`} className="rounded border border-zinc-300 px-4 py-2 dark:border-zinc-700">
              Registrar la otra parte ({registrada.tipo === "dinero" ? "producto" : "dinero"})
            </a>
          )}
          <a href="/panel" className="rounded border border-zinc-300 px-4 py-2 dark:border-zinc-700">Panel</a>
        </div>
      </div>
    );
  }

  const advertencia = estado && !estado.ok && estado.tipo === "advertencia" ? estado : null;

  return (
    <form
      ref={formulario}
      onSubmit={(e) => {
        e.preventDefault();
        enviarFormulario(false);
      }}
      className="flex w-full max-w-md flex-col gap-4 text-left"
    >
      {vinculada && (
        <>
          <input type="hidden" name="donacionVinculadaId" value={vinculada.id} />
          <p className="rounded bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            Donación mixta: la otra parte de la donación #{vinculada.id} de {vinculada.donanteNombre}.
          </p>
        </>
      )}

      <fieldset className="flex gap-6 text-sm">
        <legend className="mb-1">Tipo</legend>
        {(vinculada ? [tipo] : ["dinero", "producto"]).map((t) => (
          <label key={t} className="flex items-center gap-2">
            <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} />
            {t === "dinero" ? "Dinero" : "Producto"}
          </label>
        ))}
        {errores.tipo && <span role="alert" className="text-red-700 dark:text-red-400">{errores.tipo[0]}</span>}
      </fieldset>

      {vinculada ? (
        <input type="hidden" name="apoyanteId" value={vinculada.apoyanteId} />
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Buscar donante
            <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Escribe para filtrar" className={entrada} />
          </label>
          <Campo etiqueta={`Donante (${donantes.length})`} error={errores.apoyanteId?.[0]}>
            <select name="apoyanteId" required defaultValue="" className={entrada}>
              <option value="" disabled>Elige un donante…</option>
              {donantes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}{d.anonimoPublico ? " (anónimo en lo público)" : ""}
                </option>
              ))}
            </select>
          </Campo>
          <p className="-mt-2 text-xs text-zinc-600 dark:text-zinc-400">
            ¿No está?{" "}
            <a href="/apoyantes/nuevo" target="_blank" rel="noopener noreferrer" className="underline">Crear un apoyante nuevo</a>{" "}
            (se abre en otra pestaña) y luego{" "}
            <button type="button" onClick={() => router.refresh()} className="underline">actualizar la lista</button>.
          </p>
        </>
      )}

      <Campo etiqueta="Proyecto" error={errores.proyectoId?.[0]}>
        <select name="proyectoId" value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} required className={entrada}>
          <option value="" disabled>Elige un proyecto…</option>
          {datos.proyectos.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
          <option value="sin-asignar">Sin asignar (se asigna después)</option>
        </select>
      </Campo>

      {tipo === "dinero" ? (
        <>
          <Campo etiqueta="Monto en soles (S/)" error={errores.monto?.[0]}>
            <input name="monto" required inputMode="decimal" placeholder="150,50" className={entrada} />
          </Campo>
          <Campo etiqueta="Medio" error={errores.medio?.[0]}>
            <select name="medio" required defaultValue="" className={entrada}>
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
              Este proyecto no tiene meta. Elige «Sin asignar» o crea antes el ítem.
            </p>
          )}
          {proyecto && proyecto.tieneMeta && (
            <Campo etiqueta="Ítem" error={errores.itemId?.[0]}>
              <select name="itemId" required defaultValue="" className={entrada}>
                <option value="" disabled>{proyecto.items.length ? "Elige el ítem…" : "Este proyecto no tiene ítems"}</option>
                {proyecto.items.map((i) => (
                  <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>
                ))}
              </select>
            </Campo>
          )}
          {sinAsignar && (
            <Campo etiqueta="¿Qué se recibió?" error={errores.descripcionProducto?.[0]}>
              <input name="descripcionProducto" required maxLength={200} placeholder="Cajas de cereal" className={entrada} />
            </Campo>
          )}
          <Campo etiqueta="Cantidad" error={errores.cantidad?.[0]}>
            <input name="cantidad" required inputMode="numeric" className={entrada} />
          </Campo>
        </>
      )}

      <Campo etiqueta="Fecha en que se recibió" error={errores.fecha?.[0]}>
        <input type="date" name="fecha" required defaultValue={vinculada?.fecha ?? datos.hoy} max={datos.hoy} className={entrada} />
      </Campo>

      <Mensajes estado={estado} />
      {advertencia && (
        <button type="button" disabled={pendiente} onClick={() => enviarFormulario(true)} className="rounded border border-amber-600 px-4 py-2 text-amber-900 dark:text-amber-200">
          Guardar de todos modos
        </button>
      )}
      <button type="submit" disabled={pendiente} className={boton}>
        {pendiente ? "Guardando…" : "Registrar donación"}
      </button>
    </form>
  );
}
