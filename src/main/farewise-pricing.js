function amount(value) {
  if (value == null || (typeof value === "string" && !value.trim())) return undefined;
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function getFarewisePrices(rec, total, adults, children, rate = 1) {
  const fare = (passenger) => {
    const totalPrice = amount(passenger?.total);
    const sellPrice = amount(passenger?.sell);
    return totalPrice === 0 && sellPrice > 0 ? sellPrice : totalPrice ?? sellPrice;
  };
  const option = rec.options?.[0];
  const getPassengerFare = (type) => {
    const recommendationFare = fare(rec[type]);
    const optionFare = fare(option?.[type]);
    return recommendationFare === 0 && optionFare > 0
      ? optionFare
      : recommendationFare ?? optionFare;
  };
  const adultPrice = getPassengerFare("adult");
  let childPrice = children > 0 ? getPassengerFare("child") : undefined;
  const groupTotal = amount(total);
  if (childPrice === 0 && adultPrice != null && groupTotal != null &&
      Math.abs(groupTotal - adultPrice * adults) > 1) {
    childPrice = undefined;
  }

  return {
    adultPrice: adultPrice == null ? undefined : adultPrice * rate,
    childPrice: childPrice == null ? undefined : childPrice * rate,
  };
}
