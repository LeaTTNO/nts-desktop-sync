import { strict as assert } from "node:assert";
import { test } from "node:test";
import { getFarewiseCarriers } from "./farewise-carriers.js";

test("keeps marketed and operating airlines distinct for codeshares", () => {
  assert.deepEqual(getFarewiseCarriers({
    marketingCarrier: { code: "IB" },
    operatingCarrier: { code: "QR" },
  }), { carrierCode: "IB", operatingCarrierCode: "QR" });
});

test("handles flat and nested carrier fields without inventing an operator", () => {
  assert.deepEqual(getFarewiseCarriers({
    marketingCarrierCode: " ib ",
    operatingCarrierCode: "qr",
  }), { carrierCode: "IB", operatingCarrierCode: "QR" });
  assert.deepEqual(getFarewiseCarriers({
    carrier: { code: "QR" },
    operating: { carrierCode: "BA" },
  }), { carrierCode: "QR", operatingCarrierCode: "BA" });
  assert.deepEqual(getFarewiseCarriers({ marketingCarrier: "IB" }), {
    carrierCode: "IB",
    operatingCarrierCode: undefined,
  });
  assert.deepEqual(getFarewiseCarriers({}), { carrierCode: "", operatingCarrierCode: undefined });
});
