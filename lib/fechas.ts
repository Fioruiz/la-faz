// Lima no tiene horario de verano (UTC-5 todo el año). Vercel corre en UTC: de noche en Lima ya es
// "mañana" para el servidor, así que "hoy" se calcula con la zona de Lima y no con la del servidor.
const ZONA = "America/Lima";

const formato = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });

// "YYYY-MM-DD" del día de Lima en el instante dado.
export function hoyEnLima(ahora: Date = new Date()): string {
  return formato.format(ahora);
}

// Formato YYYY-MM-DD y día que existe en el calendario ("2026-02-30" no).
export function esFechaValida(texto: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return false;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}
