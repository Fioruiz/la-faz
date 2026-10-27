import { and, asc, count, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { LectorDb } from "./auth-credentials";
import type { ResponsableActivo } from "./responsable-activo";
import { AVANCE_VACIO, consultarAvance } from "./avance-consulta";
import type { AvanceProyecto } from "./avance";
import { hoyEnLima } from "./fechas";
import { validarRango } from "./reporte";
import { consultarReporte } from "./reporte-consulta";
import { apoyantes, donaciones, itemsMeta, proyectos, responsables, voluntariosInscritos } from "./schema";

const ID_MAXIMO = 2_147_483_647;
const LIMITE_APOYANTES = 200;

// Para buscar sin distinguir mayúsculas ni tildes ("perez" encuentra "Pérez").
const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es").trim();

const LIMITE_DONACIONES = 100;
const LIMITE_VOLUNTARIOS = 200;

// Proyectos activos con sus ítems: lo que necesitan los formularios de donación (registrar, editar, asignar).
async function proyectosActivosConItems(db: LectorDb) {
  const activos = await db
    .select({ id: proyectos.id, nombre: proyectos.nombre, tieneMeta: proyectos.tieneMeta })
    .from(proyectos)
    .where(eq(proyectos.estado, "activo"))
    .orderBy(asc(proyectos.nombre));
  const items = activos.length
    ? await db
        .select({ id: itemsMeta.id, proyectoId: itemsMeta.proyectoId, nombre: itemsMeta.nombre, unidad: itemsMeta.unidad })
        .from(itemsMeta)
        .where(inArray(itemsMeta.proyectoId, activos.map((p) => p.id)))
        .orderBy(asc(itemsMeta.nombre))
    : [];
  return activos.map((p) => ({ ...p, items: items.filter((i) => i.proyectoId === p.id) }));
}

// Cada consulta privada recibe la comprobación de responsable activo y la ejecuta primero.
// La aplicación le pasa requireResponsableActivo() y getDb(); las pruebas, una comprobación contra
// la base de pruebas, y así recorren todas las funciones sin levantar Next.
// La base se pide de forma perezosa: importar el módulo no debe exigir DATABASE_URL.
export function crearConsultasPrivadas(requerir: () => Promise<ResponsableActivo>, obtenerDb: () => LectorDb) {
  return {
    async getPanel() {
      const responsable = await requerir();
      return { id: responsable.id, nombre: responsable.nombre };
    },

    // Activos primero, luego por nombre. `cantidadItems` cuenta los ítems con meta del proyecto.
    async listarProyectos() {
      await requerir();
      return obtenerDb()
        .select({
          id: proyectos.id,
          nombre: proyectos.nombre,
          estado: proyectos.estado,
          tieneMeta: proyectos.tieneMeta,
          cantidadItems: count(itemsMeta.id),
        })
        .from(proyectos)
        .leftJoin(itemsMeta, eq(itemsMeta.proyectoId, proyectos.id))
        .groupBy(proyectos.id)
        .orderBy(asc(proyectos.estado), asc(proyectos.nombre));
    },

    // El proyecto con sus ítems por nombre, o null si no existe o el id no es válido.
    async getProyecto(id: number) {
      await requerir();
      if (!Number.isSafeInteger(id) || id < 1 || id > ID_MAXIMO) return null;
      const db = obtenerDb();
      const [proyecto] = await db
        .select({
          id: proyectos.id,
          nombre: proyectos.nombre,
          descripcion: proyectos.descripcion,
          tieneMeta: proyectos.tieneMeta,
          estado: proyectos.estado,
          resultado: proyectos.resultado,
        })
        .from(proyectos)
        .where(eq(proyectos.id, id))
        .limit(1);
      if (!proyecto) return null;
      const items = await db
        .select({
          id: itemsMeta.id,
          nombre: itemsMeta.nombre,
          unidad: itemsMeta.unidad,
          cantidadMeta: itemsMeta.cantidadMeta,
          costoReferencial: itemsMeta.costoReferencial,
        })
        .from(itemsMeta)
        .where(eq(itemsMeta.proyectoId, id))
        .orderBy(asc(itemsMeta.nombre));
      // El avance sale de la consulta compartida (lib/avance-consulta.ts): nada se suma aquí ni en las páginas.
      const { proyectos: avances, sinAsignar } = await consultarAvance(db, { proyectoIds: [id] });
      return { ...proyecto, items, avance: avances[id] ?? AVANCE_VACIO, sinAsignar };
    },

    // Resumen de avance de TODOS los proyectos (los que no tienen ítems ni dinero salen vacíos) y lo sin asignar.
    async getAvanceProyectos(): Promise<{ proyectos: Record<number, AvanceProyecto>; sinAsignar: { totalDinero: string; cantidad: number } }> {
      await requerir();
      const db = obtenerDb();
      const ids = (await db.select({ id: proyectos.id }).from(proyectos)).map((p) => p.id);
      const { proyectos: avances, sinAsignar } = await consultarAvance(db);
      return { proyectos: Object.fromEntries(ids.map((id) => [id, avances[id] ?? AVANCE_VACIO])), sinAsignar };
    },

    // Sin contacto: la lista no lo muestra (minimización de datos personales). Se filtra en memoria,
    // no con ILIKE, para tratar `%` y `_` como texto y entender tildes; sirve para cientos o pocos
    // miles de apoyantes. `rol` válido: "donante" o "voluntario"; cualquier otro valor se ignora.
    async listarApoyantes(opciones: { busqueda?: string; rol?: string } = {}) {
      await requerir();
      const filas = await obtenerDb()
        .select({
          id: apoyantes.id,
          nombre: apoyantes.nombre,
          esDonante: apoyantes.esDonante,
          esVoluntario: apoyantes.esVoluntario,
          anonimoPublico: apoyantes.anonimoPublico,
        })
        .from(apoyantes);
      const buscada = normalizar(opciones.busqueda ?? "");
      const coincidentes = filas
        .filter((a) => (opciones.rol === "donante" ? a.esDonante : opciones.rol === "voluntario" ? a.esVoluntario : true))
        .filter((a) => buscada === "" || normalizar(a.nombre).includes(buscada))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      return {
        filas: coincidentes.slice(0, LIMITE_APOYANTES),
        total: coincidentes.length,
        hayMas: coincidentes.length > LIMITE_APOYANTES,
      };
    },

    // Todo lo que el formulario de registrar donación necesita en una lectura: donantes (sin contacto),
    // proyectos activos con sus ítems, el proyecto por defecto y "hoy" en Lima. El proyecto por defecto
    // es el de la última donación asignada de este responsable, solo si ese proyecto sigue activo.
    async getDatosFormularioDonacion() {
      const responsable = await requerir();
      const db = obtenerDb();
      const donantes = (
        await db
          .select({ id: apoyantes.id, nombre: apoyantes.nombre, anonimoPublico: apoyantes.anonimoPublico })
          .from(apoyantes)
          .where(eq(apoyantes.esDonante, true))
      ).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      const activos = await proyectosActivosConItems(db);
      const [ultima] = await db
        .select({ proyectoId: donaciones.proyectoId })
        .from(donaciones)
        .where(and(eq(donaciones.registradoPor, responsable.id), isNotNull(donaciones.proyectoId)))
        .orderBy(desc(donaciones.id))
        .limit(1);
      const proyectoPorDefectoId = activos.some((p) => p.id === ultima?.proyectoId) ? (ultima?.proyectoId ?? null) : null;
      return {
        donantes,
        proyectos: activos,
        proyectoPorDefectoId,
        hoy: hoyEnLima(),
      };
    },

    // Las 100 donaciones más recientes (fecha y luego id, descendentes). `filtro`: "sin-asignar" (sin proyecto y
    // no anuladas), "anuladas" o cualquier otro valor = todas. Búsqueda por nombre del donante en memoria
    // (sin tildes ni comodines). Muestra el nombre real del donante (zona privada) y nunca su contacto.
    async listarDonaciones(opciones: { filtro?: string; busqueda?: string } = {}) {
      await requerir();
      const db = obtenerDb();
      const condicion =
        opciones.filtro === "sin-asignar"
          ? and(isNull(donaciones.proyectoId), eq(donaciones.anulada, false))
          : opciones.filtro === "anuladas"
            ? eq(donaciones.anulada, true)
            : undefined;
      const filas = await db
        .select({
          id: donaciones.id,
          fecha: donaciones.fecha,
          tipo: donaciones.tipo,
          monto: donaciones.monto,
          medio: donaciones.medio,
          cantidad: donaciones.cantidad,
          descripcion: donaciones.descripcionProducto,
          anulada: donaciones.anulada,
          donacionVinculadaId: donaciones.donacionVinculadaId,
          proyectoId: donaciones.proyectoId,
          proyectoNombre: proyectos.nombre,
          itemNombre: itemsMeta.nombre,
          itemUnidad: itemsMeta.unidad,
          donanteNombre: apoyantes.nombre,
        })
        .from(donaciones)
        .innerJoin(apoyantes, eq(apoyantes.id, donaciones.apoyanteId))
        .leftJoin(proyectos, eq(proyectos.id, donaciones.proyectoId))
        .leftJoin(itemsMeta, eq(itemsMeta.id, donaciones.itemId))
        .where(condicion)
        .orderBy(desc(donaciones.fecha), desc(donaciones.id));
      const apuntadas = new Set(
        (await db.select({ v: donaciones.donacionVinculadaId }).from(donaciones).where(isNotNull(donaciones.donacionVinculadaId))).map((f) => f.v),
      );
      const buscada = normalizar(opciones.busqueda ?? "");
      const coincidentes = filas.filter((f) => buscada === "" || normalizar(f.donanteNombre).includes(buscada));
      return {
        filas: coincidentes.slice(0, LIMITE_DONACIONES).map((f) => ({ ...f, esParteMixta: f.donacionVinculadaId !== null || apuntadas.has(f.id) })),
        total: coincidentes.length,
        hayMas: coincidentes.length > LIMITE_DONACIONES,
      };
    },

    // Detalle de una donación para verla y corregirla, o null si no existe o el id no es válido. `soloLectura`
    // y `razonSoloLectura` dicen cuándo no se debe ofrecer ningún formulario (anulada o proyecto finalizado).
    async getDonacion(id: number) {
      await requerir();
      if (!Number.isSafeInteger(id) || id < 1 || id > ID_MAXIMO) return null;
      const db = obtenerDb();
      const [d] = await db
        .select({
          id: donaciones.id,
          apoyanteId: donaciones.apoyanteId,
          donanteNombre: apoyantes.nombre,
          tipo: donaciones.tipo,
          monto: donaciones.monto,
          medio: donaciones.medio,
          cantidad: donaciones.cantidad,
          descripcion: donaciones.descripcionProducto,
          fecha: donaciones.fecha,
          anulada: donaciones.anulada,
          donacionVinculadaId: donaciones.donacionVinculadaId,
          proyectoId: donaciones.proyectoId,
          proyectoNombre: proyectos.nombre,
          proyectoEstado: proyectos.estado,
          itemId: donaciones.itemId,
          itemNombre: itemsMeta.nombre,
          itemUnidad: itemsMeta.unidad,
          registradoPorNombre: responsables.nombre,
        })
        .from(donaciones)
        .innerJoin(apoyantes, eq(apoyantes.id, donaciones.apoyanteId))
        .innerJoin(responsables, eq(responsables.id, donaciones.registradoPor))
        .leftJoin(proyectos, eq(proyectos.id, donaciones.proyectoId))
        .leftJoin(itemsMeta, eq(itemsMeta.id, donaciones.itemId))
        .where(eq(donaciones.id, id))
        .limit(1);
      if (!d) return null;
      const [apuntaAEsta] = await db
        .select({ id: donaciones.id, tipo: donaciones.tipo })
        .from(donaciones)
        .where(eq(donaciones.donacionVinculadaId, id))
        .limit(1);
      const [vinculada] =
        d.donacionVinculadaId !== null
          ? await db.select({ id: donaciones.id, tipo: donaciones.tipo }).from(donaciones).where(eq(donaciones.id, d.donacionVinculadaId)).limit(1)
          : [];
      const razonSoloLectura = d.anulada
        ? "Esta donación está anulada."
        : d.proyectoEstado === "finalizado"
          ? "El proyecto de esta donación está finalizado y es de solo lectura."
          : null;
      return {
        ...d,
        pareja: vinculada ?? apuntaAEsta ?? null,
        soloLectura: razonSoloLectura !== null,
        razonSoloLectura,
        proyectosDestino: razonSoloLectura ? [] : await proyectosActivosConItems(db),
      };
    },

    // Reporte por responsable y por proyecto (#10), con rango de fechas opcional ya validado. Solo agregados:
    // sin nombres ni contactos de donantes. Un rango inválido devuelve el error sin consultar la base.
    async getReporte(opciones: { desde?: string; hasta?: string } = {}) {
      await requerir();
      const rango = validarRango(opciones.desde, opciones.hasta, hoyEnLima());
      if (!rango.ok) return { ok: false as const, error: rango.error };
      return { ok: true as const, reporte: await consultarReporte(obtenerDb(), { desde: rango.desde, hasta: rango.hasta }) };
    },

    // Lo necesario para registrar la otra parte de una donación mixta, o null si no existe o el id no es válido.
    // `puedeVincularse` es falso si está anulada o ya forma parte de una pareja.
    async getDonacionParaVincular(id: number) {
      await requerir();
      if (!Number.isSafeInteger(id) || id < 1 || id > ID_MAXIMO) return null;
      const db = obtenerDb();
      const [d] = await db
        .select({
          id: donaciones.id,
          apoyanteId: donaciones.apoyanteId,
          tipo: donaciones.tipo,
          fecha: donaciones.fecha,
          proyectoId: donaciones.proyectoId,
          anulada: donaciones.anulada,
          donacionVinculadaId: donaciones.donacionVinculadaId,
        })
        .from(donaciones)
        .where(eq(donaciones.id, id))
        .limit(1);
      if (!d) return null;
      const [{ n: apuntanA }] = await db
        .select({ n: count() })
        .from(donaciones)
        .where(eq(donaciones.donacionVinculadaId, id));
      const [donante] = await db.select({ nombre: apoyantes.nombre }).from(apoyantes).where(eq(apoyantes.id, d.apoyanteId)).limit(1);
      return {
        ...d,
        donanteNombre: donante?.nombre ?? "",
        puedeVincularse: !d.anulada && d.donacionVinculadaId === null && apuntanA === 0,
      };
    },

    // Las inscripciones más recientes primero. NUNCA selecciona el contacto: solo se ve en el detalle del apoyante.
    async listarVoluntarios() {
      await requerir();
      const db = obtenerDb();
      const [filas, [{ n: total }]] = await Promise.all([
        db
          .select({
            id: voluntariosInscritos.id,
            apoyanteId: apoyantes.id,
            nombre: apoyantes.nombre,
            mensaje: voluntariosInscritos.mensaje,
            creadoEn: voluntariosInscritos.creadoEn,
          })
          .from(voluntariosInscritos)
          .innerJoin(apoyantes, eq(apoyantes.id, voluntariosInscritos.apoyanteId))
          .orderBy(desc(voluntariosInscritos.creadoEn), desc(voluntariosInscritos.id))
          .limit(LIMITE_VOLUNTARIOS),
        db.select({ n: count() }).from(voluntariosInscritos),
      ]);
      return { filas, total, hayMas: total > filas.length };
    },

    // El apoyante con su contacto y cuántos registros tiene, o null si no existe o el id no es válido.
    async getApoyante(id: number) {
      await requerir();
      if (!Number.isSafeInteger(id) || id < 1 || id > ID_MAXIMO) return null;
      const db = obtenerDb();
      const [apoyante] = await db.select().from(apoyantes).where(eq(apoyantes.id, id)).limit(1);
      if (!apoyante) return null;
      const [[{ n: cantidadDonaciones }], [{ n: cantidadInscripciones }]] = await Promise.all([
        db.select({ n: count() }).from(donaciones).where(eq(donaciones.apoyanteId, id)),
        db.select({ n: count() }).from(voluntariosInscritos).where(eq(voluntariosInscritos.apoyanteId, id)),
      ]);
      return {
        id: apoyante.id,
        nombre: apoyante.nombre,
        contacto: apoyante.contacto,
        esDonante: apoyante.esDonante,
        esVoluntario: apoyante.esVoluntario,
        anonimoPublico: apoyante.anonimoPublico,
        cantidadDonaciones,
        cantidadInscripciones,
      };
    },
  };
}
