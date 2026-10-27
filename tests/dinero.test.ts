import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { aCentimos, deCentimos, maximoCero, sumar } from "../lib/dinero";

describe("dinero en céntimos", () => {
  test("0.10 + 0.20 = 0.30 exacto (con coma flotante daría 0.30000000000000004)", () => {
    assert.equal(deCentimos(sumar([aCentimos("0.10"), aCentimos("0.20")])), "0.30");
  });

  test("enteros, uno y dos decimales", () => {
    assert.equal(aCentimos("150"), BigInt(15000));
    assert.equal(aCentimos("150.5"), BigInt(15050));
    assert.equal(aCentimos("150.50"), BigInt(15050));
    assert.equal(aCentimos("0"), BigInt(0));
    assert.equal(aCentimos("0.05"), BigInt(5));
  });

  test("formato de vuelta con dos decimales", () => {
    assert.equal(deCentimos(BigInt(0)), "0.00");
    assert.equal(deCentimos(BigInt(5)), "0.05");
    assert.equal(deCentimos(BigInt(15050)), "150.50");
    assert.equal(deCentimos(BigInt(-1050)), "-10.50");
  });

  test("valores de 10 dígitos enteros y multiplicación por una cantidad grande sin perder exactitud", () => {
    const max = aCentimos("9999999999.99");
    assert.equal(deCentimos(max), "9999999999.99");
    const total = BigInt(1_000_000) * aCentimos("9999999.99");
    assert.equal(deCentimos(total), "9999999990000.00");
    assert.equal(total, BigInt(1_000_000) * BigInt(999999999));
  });

  test("3 × 13.33 = 39.99", () => {
    assert.equal(deCentimos(BigInt(3) * aCentimos("13.33")), "39.99");
  });

  test("texto inválido se rechaza", () => {
    for (const malo of ["", "abc", "1,5", "1.234", "-5", "1e3", "$10", ".5"]) assert.throws(() => aCentimos(malo), /Monto inválido/, malo);
  });

  test("maximoCero y suma vacía", () => {
    assert.equal(maximoCero(BigInt(-5)), BigInt(0));
    assert.equal(maximoCero(BigInt(7)), BigInt(7));
    assert.equal(sumar([]), BigInt(0));
  });
});
