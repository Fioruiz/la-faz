import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

const creadoEn = () => timestamp("creado_en", { withTimezone: true }).notNull().defaultNow();

export const responsables = pgTable("responsables", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  nombre: text().notNull(),
  correo: text().notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  activo: boolean().notNull().default(true),
  creadoEn: creadoEn(),
});

export const proyectos = pgTable(
  "proyectos",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    nombre: text().notNull().unique(),
    descripcion: text(),
    tieneMeta: boolean("tiene_meta").notNull().default(false),
    estado: text().notNull().default("activo"),
    resultado: text(),
    creadoEn: creadoEn(),
  },
  (t) => [check("proyectos_estado_valido", sql`${t.estado} in ('activo', 'finalizado')`)],
);

export const itemsMeta = pgTable(
  "items_meta",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    proyectoId: integer("proyecto_id")
      .notNull()
      .references(() => proyectos.id),
    nombre: text().notNull(),
    unidad: text().notNull(),
    cantidadMeta: integer("cantidad_meta").notNull(),
    costoReferencial: numeric("costo_referencial", { precision: 12, scale: 2 }),
    creadoEn: creadoEn(),
  },
  (t) => [
    // Destino de la FK compuesta de donaciones (ADR 0008).
    unique("items_meta_id_proyecto_uq").on(t.id, t.proyectoId),
    index("items_meta_proyecto_idx").on(t.proyectoId),
    check("items_meta_meta_positiva", sql`${t.cantidadMeta} > 0`),
    check(
      "items_meta_costo_positivo",
      sql`${t.costoReferencial} is null or ${t.costoReferencial} > 0`,
    ),
  ],
);

export const apoyantes = pgTable(
  "apoyantes",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    nombre: text().notNull(),
    contacto: text(),
    esDonante: boolean("es_donante").notNull().default(false),
    esVoluntario: boolean("es_voluntario").notNull().default(false),
    anonimoPublico: boolean("anonimo_publico").notNull().default(false),
    creadoEn: creadoEn(),
  },
  (t) => [check("apoyantes_con_rol", sql`${t.esDonante} or ${t.esVoluntario}`)],
);

export const donaciones = pgTable(
  "donaciones",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    apoyanteId: integer("apoyante_id")
      .notNull()
      .references(() => apoyantes.id),
    // Nulo = "Sin asignar".
    proyectoId: integer("proyecto_id").references(() => proyectos.id),
    tipo: text().notNull(),
    monto: numeric({ precision: 12, scale: 2 }),
    itemId: integer("item_id"),
    cantidad: integer(),
    descripcionProducto: text("descripcion_producto"),
    medio: text(),
    fecha: date().notNull(),
    registradoPor: integer("registrado_por")
      .notNull()
      .references(() => responsables.id),
    anulada: boolean().notNull().default(false),
    donacionVinculadaId: integer("donacion_vinculada_id"),
    creadoEn: creadoEn(),
  },
  (t) => [
    foreignKey({
      name: "donaciones_item_proyecto_fk",
      columns: [t.itemId, t.proyectoId],
      foreignColumns: [itemsMeta.id, itemsMeta.proyectoId],
    }),
    foreignKey({
      name: "donaciones_vinculada_fk",
      columns: [t.donacionVinculadaId],
      foreignColumns: [t.id],
    }),
    check("donaciones_tipo_valido", sql`${t.tipo} in ('dinero', 'producto')`),
    check("donaciones_medio_valido", sql`${t.medio} in ('yape', 'plin', 'transferencia')`),
    // Los tres estados del ADR 0008. Cada comparación se protege con "is not null"
    // porque un CHECK cuyo resultado es NULL se acepta.
    check(
      "donaciones_estado_valido",
      sql`(
        ${t.tipo} = 'dinero'
        and ${t.monto} is not null and ${t.monto} > 0
        and ${t.itemId} is null and ${t.cantidad} is null
      ) or (
        ${t.tipo} = 'producto'
        and ${t.cantidad} is not null and ${t.cantidad} > 0
        and ${t.itemId} is not null and ${t.proyectoId} is not null
      ) or (
        ${t.tipo} = 'producto'
        and ${t.cantidad} is not null and ${t.cantidad} > 0
        and ${t.itemId} is null and ${t.proyectoId} is null
        and ${t.descripcionProducto} is not null
      )`,
    ),
    // Consulta de avance del ADR 0008: SUM(cantidad) de productos no anulados por ítem.
    index("donaciones_item_idx").on(t.itemId),
    index("donaciones_proyecto_idx").on(t.proyectoId),
    index("donaciones_apoyante_idx").on(t.apoyanteId),
  ],
);

export const voluntariosInscritos = pgTable("voluntarios_inscritos", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  apoyanteId: integer("apoyante_id")
    .notNull()
    .references(() => apoyantes.id),
  mensaje: text(),
  // Versión del texto de consentimiento aceptado; la fecha de aceptación es creado_en.
  consentimientoVersion: text("consentimiento_version").notNull(),
  creadoEn: creadoEn(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    entidad: text().notNull(),
    entidadId: integer("entidad_id").notNull(),
    accion: text().notNull(),
    antes: jsonb(),
    despues: jsonb(),
    responsableId: integer("responsable_id")
      .notNull()
      .references(() => responsables.id),
    creadoEn: creadoEn(),
  },
  (t) => [index("audit_log_entidad_idx").on(t.entidad, t.entidadId)],
);

// Contadores de intentos para limitar el login (por correo) y el formulario público (por IP). La `clave` es un
// resumen con clave secreta (HMAC), nunca el correo ni la IP en claro (ADR 0011). No guarda contraseñas ni datos
// del formulario. Se limpia al registrar (filas de más del doble de la ventana).
export const intentosLimitados = pgTable(
  "intentos_limitados",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    tipo: text().notNull(),
    clave: text().notNull(),
    creadoEn: creadoEn(),
  },
  (t) => [
    index("intentos_limitados_idx").on(t.tipo, t.clave, t.creadoEn),
    check("intentos_limitados_tipo_valido", sql`${t.tipo} in ('login', 'formulario')`),
  ],
);
