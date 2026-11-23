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

test("displays the operating airline when available, otherwise Farewise's carrier", () => {
  const codeshare = getFarewiseCarriers({ marketingCarrierCode: "IB", operatingCarrierCode: "QR" });
  assert.equal(display.describeSegmentAirline(codeshare, "no"), "Qatar Airways");
  assert.equal(display.describeSegmentAirline(codeshare, "da"), "Qatar Airways");
  assert.equal(display.describeSegmentAirline(getFarewiseCarriers({ marketingCarrierCode: "KL" }), "no"), "KLM");
  assert.equal(display.describeSegmentAirline(getFarewiseCarriers({ marketingCarrierCode: "IB" }), "da"), "Iberia");
  assert.equal(display.describeSegmentAirline(getFarewiseCarriers({ operatingCarrierCode: "QR" }), "no"), "Qatar Airways");
});

test("includes every distinct airline on both legs", () => {
  const segments = [
    { carrierCode: "IB", operatingCarrierCode: "QR" },
    { carrierCode: "IB", operatingCarrierCode: "QR" },
    { carrierCode: "BA", operatingCarrierCode: "BA" },
  ];
  assert.equal(display.describeItineraryAirlines(segments, "no"), "Qatar Airways / British Airways");
});

test("uses names from Farewise carriers for the result and matching segments", () => {
  const carriers = [{ code: "KL", name: "KLM fra Farewise" }];
  const segments = [{ carrierCode: "KL" }, { carrierCode: "KL" }];
  assert.equal(display.describeItineraryAirlines(segments, "no", carriers), "KLM fra Farewise");
  assert.equal(display.describeSegmentAirline(segments[0], "no", carriers, segments), "KLM fra Farewise");
});

test("uses Farewise's labelled carrier when no segment code matches", () => {
  const carriers = [{ code: "QR", name: "Qatar Airways" }];
  const segments = [{ carrierCode: "IB" }];
  assert.equal(display.describeItineraryAirlines(segments, "no", carriers), "Qatar Airways");
  assert.equal(display.describeSegmentAirline(segments[0], "no", carriers, segments), "Qatar Airways");
});

test("preserves other airlines on mixed-airline segments", () => {
  const carriers = [{ code: "SK", name: "SAS fra Farewise" }];
  const segments = [{ carrierCode: "SK" }, { carrierCode: "AF" }];
  assert.equal(display.describeItineraryAirlines(segments, "no", carriers), "SAS fra Farewise");
  assert.equal(display.describeSegmentAirline(segments[0], "no", carriers, segments), "SAS fra Farewise");
  assert.equal(display.describeSegmentAirline(segments[1], "no", carriers, segments), "Air France");
});

test("deduplicates multiple Farewise carrier names and falls back when missing", () => {
  const segments = [{ carrierCode: "KL" }];
  assert.equal(display.describeItineraryAirlines(segments, "no", [
    { code: "KL", name: "KLM" }, { code: "KL", name: "KLM" }, { code: "QR", name: "Qatar" },
  ]), "KLM / Qatar");
  assert.equal(display.describeItineraryAirlines(segments, "no", []), "KLM");
});

test("explains the basis of every estimated price in both languages", () => {
  const average = { adultsCount: 2, childrenCount: 1 };
  assert.match(display.priceEstimateExplanations(average, "no")[0], /ikke tilgjengelig fra Farewise/);
  assert.match(display.priceEstimateExplanations(average, "no")[1], /Kontroller prisen i Farewise/);
  assert.match(display.priceEstimateExplanations(average, "da")[0], /ikke tilgængelig fra Farewise/);
  const uncertain = { adultsCount: 2, childrenCount: 3, adultPrice: 100, childPrice: 50, adultPriceEstimated: true, childPriceEstimated: true };
  assert.match(display.priceEstimateExplanations(uncertain, "no")[0], /Farewise-beløpet for voksne likt på 2 voksne/);
  assert.match(display.priceEstimateExplanations(uncertain, "no")[1], /Farewise-beløpet for barn likt på 3 barn/);
  assert.deepEqual(display.priceEstimateExplanations({ adultsCount: 2, childrenCount: 1, adultPrice: 100, childPrice: 50 }, "no"), []);
});
