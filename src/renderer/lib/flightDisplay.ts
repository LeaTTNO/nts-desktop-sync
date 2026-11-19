import { airlineNames, type FlightSegment } from "./flightRobotClient";

type Language = "no" | "da";

type PriceInfo = {
  adultPrice?: number;
  childPrice?: number;
  adultPriceEstimated?: boolean;
  childPriceEstimated?: boolean;
  adultsCount: number;
  childrenCount: number;
};

const name = (code: string) => airlineNames[code] || code;

export function describeSegmentAirline(segment: Pick<FlightSegment, "carrierCode" | "operatingCarrierCode">, language: Language): string {
  const marketed = segment.carrierCode;
  const operating = segment.operatingCarrierCode;
  if (operating && marketed && operating !== marketed) {
    return language === "da"
      ? `${name(operating)} (flyves af; sælges af ${name(marketed)})`
      : `${name(operating)} (opereres av; selges av ${name(marketed)})`;
  }
  if (operating) return name(operating);
  if (marketed) {
    return language === "da"
      ? `${name(marketed)} (sælger; operatør ukendt)`
      : `${name(marketed)} (selger; operatør ukjent)`;
  }
  return language === "da" ? "Flyselskab ukendt" : "Flyselskap ukjent";
}

export function describeItineraryAirlines(segments: FlightSegment[], language: Language): string {
  const descriptions = segments.map(segment => describeSegmentAirline(segment, language));
  return [...new Set(descriptions)].join(" / ") ||
    (language === "da" ? "Flyselskab ukendt" : "Flyselskap ukjent");
}

export function priceEstimateExplanations(price: PriceInfo, language: Language): string[] {
  const da = language === "da";
  const explanations: string[] = [];
  if (price.adultPrice == null) {
    explanations.push(da
      ? `Personprisen kan ikke fastslås. Estimeret som totalprisen fordelt ligeligt på ${price.adultsCount + price.childrenCount} rejsende; den faktiske voksenpris kan afvige.`
      : `Personprisen kan ikke fastslås. Estimert som totalprisen fordelt likt på ${price.adultsCount + price.childrenCount} reisende; faktisk voksenpris kan avvike.`);
  } else if (price.adultPriceEstimated) {
    explanations.push(da
      ? `Voksenprisen kan ikke fastslås sikkert. Estimeret ved at fordele Farewise-beløbet for voksne ligeligt på ${price.adultsCount} voksne.`
      : `Voksenprisen kan ikke fastslås sikkert. Estimert ved å fordele Farewise-beløpet for voksne likt på ${price.adultsCount} voksne.`);
  }
  if (price.childrenCount > 0) {
    if (price.childPrice == null) {
      explanations.push(da
        ? "Børneprisen kan ikke fastslås. Estimeret som 75 % af den viste personpris."
        : "Barneprisen kan ikke fastslås. Estimert som 75 % av den viste personprisen.");
    } else if (price.childPriceEstimated) {
      explanations.push(da
        ? `Børneprisen kan ikke fastslås sikkert. Estimeret ved at fordele Farewise-beløbet for børn ligeligt på ${price.childrenCount} børn.`
        : `Barneprisen kan ikke fastslås sikkert. Estimert ved å fordele Farewise-beløpet for barn likt på ${price.childrenCount} barn.`);
    }
  }
  return explanations;
}
