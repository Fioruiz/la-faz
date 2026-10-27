import { z } from "zod";
import { getDb, getPool } from "../lib/db-client";
import { hashPassword } from "../lib/password";
import { responsables } from "../lib/schema";

type EscritorDb = Pick<ReturnType<typeof getDb>, "insert">;

const NOMBRES_VARIABLES = {
  nombre: "RESPONSABLE_INICIAL_NOMBRE",
  correo: "RESPONSABLE_INICIAL_CORREO",
  password: "RESPONSABLE_INICIAL_PASSWORD",
} as const;

const entradaSchema = z.object({
  nombre: z.string().trim().min(1),
  correo: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(12).max(200),
});

// Mensaje de error sin ningún valor: solo el nombre de la variable y la regla incumplida.
function validar(entrada: Record<keyof typeof NOMBRES_VARIABLES, string | undefined>) {
  const faltantes = (Object.keys(NOMBRES_VARIABLES) as (keyof typeof NOMBRES_VARIABLES)[]).filter((k) => !entrada[k]);
  if (faltantes.length > 0) {
    throw new Error(`Falta la variable de entorno ${faltantes.map((k) => NOMBRES_VARIABLES[k]).join(", ")}`);
  }
  const parsed = entradaSchema.safeParse(entrada);
  if (!parsed.success) {
    const reglas = parsed.error.issues.map((i) => {
      const variable = NOMBRES_VARIABLES[i.path[0] as keyof typeof NOMBRES_VARIABLES];
      return i.path[0] === "password" ? `${variable} debe tener al menos 12 caracteres` : `${variable} no es válida`;
    });
    throw new Error(reglas.join("; "));
  }
  return parsed.data;
}

// Crea al responsable inicial. Si el correo ya existe no cambia nada: ni contraseña, ni nombre, ni `activo`.
export async function sembrarResponsable(
  db: EscritorDb,
  entrada: Record<keyof typeof NOMBRES_VARIABLES, string | undefined>,
): Promise<{ creado: boolean }> {
  const datos = validar(entrada);
  const creados = await db
    .insert(responsables)
    .values({ nombre: datos.nombre, correo: datos.correo, passwordHash: await hashPassword(datos.password) })
    .onConflictDoNothing({ target: responsables.correo })
    .returning({ id: responsables.id });
  return { creado: creados.length > 0 };
}

// Solo se ejecuta como script (`npm run db:seed-responsable`), no al importarlo desde las pruebas.
if (import.meta.url === `file://${process.argv[1]}`) {
  const entrada = {
    nombre: process.env.RESPONSABLE_INICIAL_NOMBRE,
    correo: process.env.RESPONSABLE_INICIAL_CORREO,
    password: process.env.RESPONSABLE_INICIAL_PASSWORD,
  };
  // Se valida antes de abrir la conexión: una entrada inválida no toca la base.
  Promise.resolve()
    .then(() => {
      validar(entrada);
      return sembrarResponsable(getDb(), entrada);
    })
    .then(({ creado }) =>
      console.log(creado ? "Responsable inicial creado" : "El responsable ya existía; no se cambió nada"),
    )
    .catch((e: Error) => {
      console.error("ERROR:", e.message);
      process.exitCode = 1;
    })
    // Si la entrada era inválida o falta DATABASE_URL no se abrió ninguna conexión que cerrar.
    .finally(() => (process.env.DATABASE_URL ? getPool().end() : undefined));
}
