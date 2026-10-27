CREATE TABLE "apoyantes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "apoyantes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"contacto" text,
	"es_donante" boolean DEFAULT false NOT NULL,
	"es_voluntario" boolean DEFAULT false NOT NULL,
	"anonimo_publico" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apoyantes_con_rol" CHECK ("apoyantes"."es_donante" or "apoyantes"."es_voluntario")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"entidad" text NOT NULL,
	"entidad_id" integer NOT NULL,
	"accion" text NOT NULL,
	"antes" jsonb,
	"despues" jsonb,
	"responsable_id" integer NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donaciones" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "donaciones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"apoyante_id" integer NOT NULL,
	"proyecto_id" integer,
	"tipo" text NOT NULL,
	"monto" numeric(12, 2),
	"item_id" integer,
	"cantidad" integer,
	"descripcion_producto" text,
	"medio" text,
	"fecha" date NOT NULL,
	"registrado_por" integer NOT NULL,
	"anulada" boolean DEFAULT false NOT NULL,
	"donacion_vinculada_id" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "donaciones_tipo_valido" CHECK ("donaciones"."tipo" in ('dinero', 'producto')),
	CONSTRAINT "donaciones_medio_valido" CHECK ("donaciones"."medio" in ('yape', 'plin', 'transferencia')),
	CONSTRAINT "donaciones_estado_valido" CHECK ((
        "donaciones"."tipo" = 'dinero'
        and "donaciones"."monto" is not null and "donaciones"."monto" > 0
        and "donaciones"."item_id" is null and "donaciones"."cantidad" is null
      ) or (
        "donaciones"."tipo" = 'producto'
        and "donaciones"."cantidad" is not null and "donaciones"."cantidad" > 0
        and "donaciones"."item_id" is not null and "donaciones"."proyecto_id" is not null
      ) or (
        "donaciones"."tipo" = 'producto'
        and "donaciones"."cantidad" is not null and "donaciones"."cantidad" > 0
        and "donaciones"."item_id" is null and "donaciones"."proyecto_id" is null
        and "donaciones"."descripcion_producto" is not null
      ))
);
--> statement-breakpoint
CREATE TABLE "items_meta" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "items_meta_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"proyecto_id" integer NOT NULL,
	"nombre" text NOT NULL,
	"unidad" text NOT NULL,
	"cantidad_meta" integer NOT NULL,
	"costo_referencial" numeric(12, 2),
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_meta_id_proyecto_uq" UNIQUE("id","proyecto_id"),
	CONSTRAINT "items_meta_meta_positiva" CHECK ("items_meta"."cantidad_meta" > 0),
	CONSTRAINT "items_meta_costo_positivo" CHECK ("items_meta"."costo_referencial" is null or "items_meta"."costo_referencial" > 0)
);
--> statement-breakpoint
CREATE TABLE "proyectos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "proyectos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"descripcion" text,
	"tiene_meta" boolean DEFAULT false NOT NULL,
	"estado" text DEFAULT 'activo' NOT NULL,
	"resultado" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proyectos_nombre_unique" UNIQUE("nombre"),
	CONSTRAINT "proyectos_estado_valido" CHECK ("proyectos"."estado" in ('activo', 'finalizado'))
);
--> statement-breakpoint
CREATE TABLE "responsables" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "responsables_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"correo" text NOT NULL,
	"password_hash" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "responsables_correo_unique" UNIQUE("correo")
);
--> statement-breakpoint
CREATE TABLE "voluntarios_inscritos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "voluntarios_inscritos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"apoyante_id" integer NOT NULL,
	"mensaje" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_responsable_id_responsables_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."responsables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donaciones" ADD CONSTRAINT "donaciones_apoyante_id_apoyantes_id_fk" FOREIGN KEY ("apoyante_id") REFERENCES "public"."apoyantes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donaciones" ADD CONSTRAINT "donaciones_proyecto_id_proyectos_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donaciones" ADD CONSTRAINT "donaciones_registrado_por_responsables_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."responsables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donaciones" ADD CONSTRAINT "donaciones_item_proyecto_fk" FOREIGN KEY ("item_id","proyecto_id") REFERENCES "public"."items_meta"("id","proyecto_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donaciones" ADD CONSTRAINT "donaciones_vinculada_fk" FOREIGN KEY ("donacion_vinculada_id") REFERENCES "public"."donaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items_meta" ADD CONSTRAINT "items_meta_proyecto_id_proyectos_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voluntarios_inscritos" ADD CONSTRAINT "voluntarios_inscritos_apoyante_id_apoyantes_id_fk" FOREIGN KEY ("apoyante_id") REFERENCES "public"."apoyantes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_entidad_idx" ON "audit_log" USING btree ("entidad","entidad_id");--> statement-breakpoint
CREATE INDEX "donaciones_item_idx" ON "donaciones" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "donaciones_proyecto_idx" ON "donaciones" USING btree ("proyecto_id");--> statement-breakpoint
CREATE INDEX "donaciones_apoyante_idx" ON "donaciones" USING btree ("apoyante_id");--> statement-breakpoint
CREATE INDEX "items_meta_proyecto_idx" ON "items_meta" USING btree ("proyecto_id");