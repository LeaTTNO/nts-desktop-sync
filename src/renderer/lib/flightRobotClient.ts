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
  const result = await window.electron.ipcRenderer.invoke(
    "farewise:searchFlights",
    params
  );

  if (!result?.ok) {
    throw new Error(result?.error || "Farewise flight search failed");
  }

  return Array.isArray(result.data) ? result.data : [];
}
