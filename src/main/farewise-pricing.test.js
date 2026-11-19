import { strict as assert } from "node:assert";
import { test } from "node:test";
import { getFarewisePrices } from "./farewise-pricing.js";

test("converts passenger-type totals into individual fares", () => {
  const rec = { adult: { total: 33260 }, child: { total: 12000 } };
  assert.deepEqual(getFarewisePrices(rec, 45260, 2, 1), {
    adultPrice: 16630,
    childPrice: 12000,
    adultPriceEstimated: false,
    childPriceEstimated: false,
  });
});

test("converts totals for multiple children independently", () => {
  const rec = { adult: { total: 30000 }, child: { total: 18000 } };
  assert.deepEqual(getFarewisePrices(rec, 48000, 2, 3), {
    adultPrice: 15000,
    childPrice: 6000,
    adultPriceEstimated: false,
    childPriceEstimated: false,
  });
});

test("retains fares already provided per person", () => {
  const rec = { adult: { total: 15000 }, child: { total: 6000 } };
  assert.deepEqual(getFarewisePrices(rec, 48000, 2, 3), {
    adultPrice: 15000,
    childPrice: 6000,
    adultPriceEstimated: false,
    childPriceEstimated: false,
  });
});

test("handles single adults, missing child fares, and sell prices", () => {
  assert.deepEqual(getFarewisePrices({ adult: { sell: "13525" } }, 13525, 1, 0), {
    adultPrice: 13525,
    childPrice: undefined,
    adultPriceEstimated: false,
    childPriceEstimated: false,
  });
  assert.deepEqual(getFarewisePrices({ adult: { total: 33260 } }, 45000, 2, 1), {
    adultPrice: 16630,
    childPrice: undefined,
    adultPriceEstimated: true,
    childPriceEstimated: false,
  });
});

test("converts currency and keeps zero fares", () => {
  const rec = { adult: { total: 20000 }, child: { total: 0 } };
  assert.deepEqual(getFarewisePrices(rec, 20000, 2, 1, 0.65), {
    adultPrice: 6500,
    childPrice: 0,
    adultPriceEstimated: false,
    childPriceEstimated: false,
  });
});
