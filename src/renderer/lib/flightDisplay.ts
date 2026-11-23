import { airlineNames, type FarewiseCarrier, type FlightSegment } from "./flightRobotClient";

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

type SegmentCarrier = Pick<FlightSegment, "carrierCode" | "operatingCarrierCode">;

function carrierName(carrier: FarewiseCarrier): string {
  return carrier.name?.trim() || (carrier.code ? name(carrier.code.trim().toUpperCase()) : "");
}

export function describeSegmentAirline(
  segment: SegmentCarrier,
  language: Language,
  carriers: FarewiseCarrier[] = [],
  segments: SegmentCarrier[] = [segment],
): string {
  const marketed = segment.carrierCode;
  const operating = segment.operatingCarrierCode;
  const validCarriers = carriers.filter(carrier => carrierName(carrier));
  const matches = (code?: string) => validCarriers.find(carrier =>
    code && carrier.code?.trim().toUpperCase() === code.trim().toUpperCase());
  const match = matches(operating) || matches(marketed);
  if (match) return carrierName(match);
  if (validCarriers.length === 1 && !segments.some(item => matches(item.carrierCode) || matches(item.operatingCarrierCode))) {
    return carrierName(validCarriers[0]);
  }
  if (operating) return name(operating);
  if (marketed) return name(marketed);
  return language === "da" ? "Flyselskab ukendt" : "Flyselskap ukjent";
}

export function describeItineraryAirlines(segments: FlightSegment[], language: Language, carriers: FarewiseCarrier[] = []): string {
  const farewiseNames = carriers.map(carrierName).filter(Boolean);
  if (farewiseNames.length) return [...new Set(farewiseNames)].join(" / ");
  const descriptions = segments.map(segment => describeSegmentAirline(segment, language, carriers, segments));
  return [...new Set(descriptions)].join(" / ") ||
    (language === "da" ? "Flyselskab ukendt" : "Flyselskap ukjent");
}

export function priceEstimateExplanations(price: PriceInfo, language: Language): string[] {
  const da = language === "da";
  const explanations: string[] = [];
  if (price.adultPrice == null) {
    explanations.push(da
      ? "Voksenprisen er ikke tilgængelig fra Farewise."
      : "Voksenprisen er ikke tilgjengelig fra Farewise.");
  } else if (price.adultPriceEstimated) {
    explanations.push(da
      ? `Voksenprisen kan ikke fastslås sikkert. Estimeret ved at fordele Farewise-beløbet for voksne ligeligt på ${price.adultsCount} voksne.`
      : `Voksenprisen kan ikke fastslås sikkert. Estimert ved å fordele Farewise-beløpet for voksne likt på ${price.adultsCount} voksne.`);
  }
  if (price.childrenCount > 0) {
    if (price.childPrice == null) {
      explanations.push(da
        ? "Børneprisen er ikke tilgængelig fra Farewise. Kontrollér prisen i Farewise."
        : "Barneprisen er ikke tilgjengelig fra Farewise. Kontroller prisen i Farewise.");
    } else if (price.childPriceEstimated) {
      explanations.push(da
        ? `Børneprisen kan ikke fastslås sikkert. Estimeret ved at fordele Farewise-beløbet for børn ligeligt på ${price.childrenCount} børn.`
        : `Barneprisen kan ikke fastslås sikkert. Estimert ved å fordele Farewise-beløpet for barn likt på ${price.childrenCount} barn.`);
    }
  }
  return explanations;
}
