function amount(value) {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function getFarewisePrices(rec, total, adults, children, rate = 1) {
  const adultTotal = amount(rec.adult?.total ?? rec.adult?.sell);
  const childTotal = children > 0 ? amount(rec.child?.total ?? rec.child?.sell) : undefined;
  const groupTotal = amount(total);

  // Some responses contain unit fares; others contain totals for each passenger type.
  const unitSum = adultTotal != null && (children === 0 || childTotal != null)
    ? adultTotal * adults + (childTotal ?? 0) * children
    : undefined;
  const typeSum = adultTotal != null && (children === 0 || childTotal != null)
    ? adultTotal + (childTotal ?? 0)
    : undefined;
  const unitPrices = groupTotal != null && unitSum != null && typeSum != null &&
    Math.abs(groupTotal - unitSum) < Math.abs(groupTotal - typeSum);
  const reconciled = groupTotal != null && unitSum != null && typeSum != null &&
    Math.min(Math.abs(groupTotal - unitSum), Math.abs(groupTotal - typeSum)) <= 1;

  return {
    adultPrice: adultTotal == null ? undefined : adultTotal * rate / (unitPrices ? 1 : adults),
    childPrice: childTotal == null ? undefined : childTotal * rate / (unitPrices ? 1 : children),
    adultPriceEstimated: adultTotal != null && adults > 1 && !reconciled,
    childPriceEstimated: childTotal != null && children > 1 && !reconciled,
  };
}
