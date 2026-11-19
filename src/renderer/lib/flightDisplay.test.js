import { strict as assert } from "node:assert";
import { test } from "node:test";
import { build } from "esbuild";
import { getFarewiseCarriers } from "../../main/farewise-carriers.js";

const bundled = await build({
  entryPoints: ["src/renderer/lib/flightDisplay.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const display = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].contents).toString("base64")}`);

test("displays operator and marketed carrier for codeshare and preserves missing data", () => {
  const codeshare = getFarewiseCarriers({ marketingCarrierCode: "IB", operatingCarrierCode: "QR" });
  assert.equal(display.describeSegmentAirline(codeshare, "no"), "Qatar Airways (opereres av; selges av Iberia)");
  assert.equal(display.describeSegmentAirline(codeshare, "da"), "Qatar Airways (flyves af; sælges af Iberia)");
  assert.equal(display.describeSegmentAirline(getFarewiseCarriers({ marketingCarrierCode: "IB" }), "no"), "Iberia (selger; operatør ukjent)");
  assert.equal(display.describeSegmentAirline(getFarewiseCarriers({ operatingCarrierCode: "QR" }), "no"), "Qatar Airways");
});

test("includes every distinct airline on both legs", () => {
  const segments = [
    { carrierCode: "IB", operatingCarrierCode: "QR" },
    { carrierCode: "IB", operatingCarrierCode: "QR" },
    { carrierCode: "BA", operatingCarrierCode: "BA" },
  ];
  assert.equal(display.describeItineraryAirlines(segments, "no"), "Qatar Airways (opereres av; selges av Iberia) / British Airways");
});

test("explains the basis of every estimated price in both languages", () => {
  const average = { adultsCount: 2, childrenCount: 1 };
  assert.match(display.priceEstimateExplanations(average, "no")[0], /totalprisen fordelt likt på 3 reisende/);
  assert.match(display.priceEstimateExplanations(average, "no")[1], /75 % av den viste personprisen/);
  assert.match(display.priceEstimateExplanations(average, "da")[0], /totalprisen fordelt ligeligt på 3 rejsende/);
  const uncertain = { adultsCount: 2, childrenCount: 3, adultPrice: 100, childPrice: 50, adultPriceEstimated: true, childPriceEstimated: true };
  assert.match(display.priceEstimateExplanations(uncertain, "no")[0], /Farewise-beløpet for voksne likt på 2 voksne/);
  assert.match(display.priceEstimateExplanations(uncertain, "no")[1], /Farewise-beløpet for barn likt på 3 barn/);
  assert.deepEqual(display.priceEstimateExplanations({ adultsCount: 2, childrenCount: 1, adultPrice: 100, childPrice: 50 }, "no"), []);
});
