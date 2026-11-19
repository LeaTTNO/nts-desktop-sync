function code(value) {
  const candidate = typeof value === "string" ? value : value?.code;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim().toUpperCase() : undefined;
}

export function getFarewiseCarriers(segment) {
  return {
    carrierCode: code(segment.marketingCarrierCode) ?? code(segment.marketingCarrier) ??
      code(segment.carrier) ?? code(segment.airlineCode) ?? "",
    operatingCarrierCode: code(segment.operatingCarrierCode) ?? code(segment.operatingCarrier) ??
      code(segment.operatingAirlineCode) ?? code(segment.operatingAirline) ??
      code(segment.operating?.carrierCode) ?? code(segment.operating?.carrier),
  };
}
