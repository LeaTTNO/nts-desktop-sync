// Renderer-side client for Farewise flight search
// Uses IPC to Electron main (NO env vars, NO fetch here)

export interface FlightSearchParams {
  originLocationCode: string;
  destinationLocationCode: string;
  departureDate: string;
  returnDate?: string;
  returnOriginCode?: string;
  returnDestinationCode?: string;
  adults: number;
  currencyCode?: string;
  max?: number;
  language?: "no" | "da"; // For å velge riktig Farewise-region
}

export interface FlightSegment {
  departure: {
    iataCode: string;
    at: string;
  };
  arrival: {
    iataCode: string;
    at: string;
  };
  carrierCode: string;
  number: string;
  duration: string;
  numberOfStops: number;
}

export interface FlightItinerary {
  duration: string;
  segments: FlightSegment[];
}

export interface FlightOffer {
  id: string;
  price: {
    total: string;
    currency: string;
    grandTotal: string;
  };
  fareType?: "PUBLIC" | "NEGOTIATED";
  travelClass?: "ECONOMY" | "BUSINESS" | "FIRST";
  itineraries: FlightItinerary[];
  validatingAirlineCodes: string[];
  numberOfBookableSeats: number;
}

/**
 * Search flights via Farewise (Electron main)
 * Drop-in replacement for Amadeus client
 */
export async function searchFlights(
  params: FlightSearchParams
): Promise<FlightOffer[]> {
  // @ts-expect-error – exposed via preload
  const result = await window.electron.invoke(
    "farewise:searchFlights",
    params
  );

  if (!result?.ok) {
    throw new Error(result?.error || "Farewise flight search failed");
  }

  // Result.data er allerede array fra converter
  return Array.isArray(result.data) ? result.data : [];
}

// Airline codes to names mapping (common ones)
export const airlineNames: Record<string, string> = {
  KL: "KLM",
  ET: "Ethiopian Airlines",
  QR: "Qatar Airways",
  EK: "Emirates",
  TK: "Turkish Airlines",
  LH: "Lufthansa",
  AF: "Air France",
  BA: "British Airways",
  SK: "SAS",
  KQ: "Kenya Airways",
  SN: "Brussels Airlines",
};

// Airport codes to city names
export const airportNames: Record<string, string> = {
  OSL: "Oslo",
  CPH: "København",
  ARN: "Stockholm",
  JRO: "Kilimanjaro",
  DAR: "Dar es Salaam",
  ZNZ: "Zanzibar",
  NBO: "Nairobi",
  ADD: "Addis Ababa",
  DOH: "Doha",
  DXB: "Dubai",
  IST: "Istanbul",
  AMS: "Amsterdam",
  FRA: "Frankfurt",
  LHR: "London",
  CDG: "Paris",
};

