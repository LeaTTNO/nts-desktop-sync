import { strict as assert } from "node:assert";
import { test } from "node:test";
import { getFarewisePrices } from "./farewise-pricing.js";

test("keeps Farewise passenger prices per person even when totals do not reconcile", () => {
  const rec = { adult: { total: 13501 }, child: { total: 11657 } };
  assert.deepEqual(getFarewisePrices(rec, 13581, 1, 1), {
    adultPrice: 13501,
    childPrice: 11657,
  });
  assert.deepEqual(getFarewisePrices(rec, 50316, 2, 2), {
    adultPrice: 13501,
    childPrice: 11657,
  });
});

test("uses a positive sell price instead of a zero placeholder", () => {
  const rec = { adult: { total: 13501 }, child: { total: 0, sell: 11657 } };
  assert.equal(getFarewisePrices(rec, 13581, 1, 1).childPrice, 11657);
});

test("keeps per-person fares instead of dividing based on an ambiguous group total", () => {
  const rec = { adult: { total: 33260 }, child: { total: 12000 } };
  assert.deepEqual(getFarewisePrices(rec, 45260, 2, 1), {
    adultPrice: 33260,
    childPrice: 12000,
  });
  assert.deepEqual(getFarewisePrices(rec, 45000, 2, 1), {
    adultPrice: 33260,
    childPrice: 12000,
  });
});

test("reads the captured KLM fares without including the distribution charge", () => {
  const rec = {
    adult: { sell: 13501, total: 13501 },
    child: { sell: 11657, total: 11657 },
    options: [{
      adult: { sell: 13501, total: 0 },
      child: { sell: 11657, total: 0 },
      total: 25318,
    }],
  };
  assert.deepEqual(getFarewisePrices(rec, rec.options[0].total, 1, 1), {
    adultPrice: 13501,
    childPrice: 11657,
  });
  assert.deepEqual(getFarewisePrices({ options: rec.options }, 25318, 1, 1), {
    adultPrice: 13501,
    childPrice: 11657,
  });
  assert.equal(getFarewisePrices({ child: { total: 0 }, options: rec.options }, 25318, 1, 1).childPrice, 11657);
});

test("does not display an inconsistent zero child price as a fare", () => {
  const rec = { adult: { total: 13501 }, child: { total: 0 } };
  assert.equal(getFarewisePrices(rec, 13581, 1, 1).childPrice, undefined);
  assert.equal(getFarewisePrices(rec, 13501, 1, 1).childPrice, 0);
});

test("handles missing, invalid, and sell prices without inventing a fare", () => {
  assert.deepEqual(getFarewisePrices({ adult: { sell: "13525" }, child: { total: " " } }, 13525, 1, 1), {
    adultPrice: 13525,
    childPrice: undefined,
  });
  assert.equal(getFarewisePrices({ adult: { total: true }, child: { total: {} } }, 100, 1, 1).childPrice, undefined);
  assert.equal(getFarewisePrices({ child: { total: 500 } }, 100, 1, 0).childPrice, undefined);
});

test("converts Farewise prices when a conversion is requested", () => {
  const rec = { adult: { total: 20000 }, child: { total: 10000 } };
  assert.deepEqual(getFarewisePrices(rec, 30000, 1, 1, 0.65), {
    adultPrice: 13000,
    childPrice: 6500,
  });
});
