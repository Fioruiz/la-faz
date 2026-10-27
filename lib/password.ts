import bcrypt from "bcryptjs";

const RONDAS = 12;

// Hash de una contraseña que no pertenece a nadie. Se compara cuando el correo no existe
// para que el tiempo de respuesta se parezca al de un correo real.
const HASH_FICTICIO = "$2b$12$5TyjlB6XLj7xuoeGg3/hUOybDKggSk0TmtZnvivwy4L484CAltciO";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, RONDAS);
}

export function verificarPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function compararConHashFicticio(password: string): Promise<false> {
  await bcrypt.compare(password, HASH_FICTICIO);
  return false;
}
