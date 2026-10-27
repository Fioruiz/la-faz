// Dinero en céntimos enteros (BigInt): nunca coma flotante. El `numeric(12,2)` de la base llega como texto
// ("150.50"); cantidad entera × costo en céntimos es exacta, así que no hay redondeo.

const CIEN = BigInt(100);
const CERO = BigInt(0);

export function aCentimos(texto: string): bigint {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(texto.trim());
  if (!m) throw new Error("Monto inválido");
  return BigInt(m[1]) * CIEN + BigInt((m[2] ?? "").padEnd(2, "0") || "0");
}

export function deCentimos(valor: bigint): string {
  const negativo = valor < CERO;
  const absoluto = negativo ? -valor : valor;
  return `${negativo ? "-" : ""}${absoluto / CIEN}.${String(absoluto % CIEN).padStart(2, "0")}`;
}

export function sumar(valores: readonly bigint[]): bigint {
  return valores.reduce((total, v) => total + v, CERO);
}

export const maximoCero = (valor: bigint): bigint => (valor < CERO ? CERO : valor);
