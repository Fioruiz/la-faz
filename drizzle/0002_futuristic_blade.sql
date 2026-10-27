CREATE TABLE "intentos_limitados" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "intentos_limitados_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tipo" text NOT NULL,
	"clave" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "intentos_limitados_tipo_valido" CHECK ("intentos_limitados"."tipo" in ('login', 'formulario'))
);
--> statement-breakpoint
CREATE INDEX "intentos_limitados_idx" ON "intentos_limitados" USING btree ("tipo","clave","creado_en");