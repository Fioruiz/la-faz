import assert from "node:assert/strict";
import { test } from "node:test";
import { formatearSoles } from "../lib/formato";

test("agrupa por miles y conserva dos decimales sin pasar por coma flotante", () => {
  assert.equal(formatearSoles("0.00"), "S/ 0.00");
  assert.equal(formatearSoles("5400.00"), "S/ 5,400.00");
  assert.equal(formatearSoles("150.50"), "S/ 150.50");
  assert.equal(formatearSoles("9999999990000.00"), "S/ 9,999,999,990,000.00");
});
