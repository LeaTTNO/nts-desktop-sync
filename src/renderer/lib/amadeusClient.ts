// Amadeus API Client for Flight Search
// Using test credentials - will be replaced with production keys later

const AMADEUS_API_KEY = "zeKUVC7hH1BnWnjeJEHMlbzYhjTmfJ0F";
const AMADEUS_API_SECRET = "mqLjoE1HGUhJn9CP";
const AMADEUS_BASE_URL = "https://test.api.amadeus.com";

// Rate limiting for test API (max ~1 request per second)
const MIN_REQUEST_INTERVAL_MS = 1200; // 1.2 seconds between requests
let lastRequestTime = 0;

async function rateLimitedFetch(url: string, options: RequestInit): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  return fetch(url, options);
}

interface AmadeusToken {
  access_token: string;
  expires_at: number;
}

let cachedToken: AmadeusToken | null = null;

export async function getAmadeusToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && cachedToken.expires_at > Date.now()) {
    return cachedToken.access_token;
  }

  const response = await fetch(`${AMADEUS_BASE_URL}/v1/security/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: AMADEUS_API_KEY,
      client_secret: AMADEUS_API_SECRET,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to authenticate with Amadeus API");
  }

  const data = await response.json();
  
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000, // Expire 1 min early
  };

  return cachedToken.access_token;
}

export interface FlightSearchParams {
  originLocationCode: string;
  destinationLocationCode: string;
  departureDate: string;
  returnDate?: string;
  returnOriginCode?: string; // For open-jaw: return from different airport
  returnDestinationCode?: string; // For open-jaw: return to different airport than origin
  adults: number;
  currencyCode?: string;
  max?: number;
}

export interface FlightSegment {
  departure: {
    iataCode: string;
    terminal?: string;
    at: string;
  };
  arrival: {
    iataCode: string;
    terminal?: string;
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

export interface FlightSearchResult {
  data: FlightOffer[];
  dictionaries?: {
    carriers?: Record<string, string>;
    aircraft?: Record<string, string>;
  };
}

export async function searchFlights(params: FlightSearchParams): Promise<FlightSearchResult> {
  const token = await getAmadeusToken();

  // Check if this is an open-jaw search (different return airport)
  const isOpenJaw = params.returnDate && params.returnOriginCode && 
    params.returnOriginCode !== params.destinationLocationCode;

  console.log("Flight search params:", {
    origin: params.originLocationCode,
    destination: params.destinationLocationCode,
    returnFrom: params.returnOriginCode,
    isOpenJaw,
    departureDate: params.departureDate,
    returnDate: params.returnDate,
  });

  if (isOpenJaw) {
    // Use POST endpoint for open-jaw/multi-city flights
    try {
      const result = await searchFlightsPost(params, token);
      console.log("Open-jaw search returned", result.data?.length || 0, "offers");
      return result;
    } catch (error) {
      console.warn("Open-jaw search failed, falling back to standard search:", error);
      // Fallback: search as round-trip to destination (ignoring returnFrom)
    }
  }

  // Standard round-trip or one-way search using GET
  const searchParams = new URLSearchParams({
    originLocationCode: params.originLocationCode,
    destinationLocationCode: params.destinationLocationCode,
    departureDate: params.departureDate,
    adults: params.adults.toString(),
    currencyCode: params.currencyCode || "NOK",
    max: (params.max || 10).toString(),
  });

  if (params.returnDate) {
    searchParams.append("returnDate", params.returnDate);
  }

  console.log("Standard search URL:", `${AMADEUS_BASE_URL}/v2/shopping/flight-offers?${searchParams}`);

  const response = await rateLimitedFetch(
    `${AMADEUS_BASE_URL}/v2/shopping/flight-offers?${searchParams}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Amadeus API error:", errorData);
    throw new Error(errorData?.errors?.[0]?.detail || "Flight search failed");
  }

  const result = await response.json();
  console.log("Standard search returned", result.data?.length || 0, "offers");
  return result;
}

// POST endpoint for open-jaw and multi-city searches
async function searchFlightsPost(params: FlightSearchParams, token: string): Promise<FlightSearchResult> {
  const originDestinations = [
    {
      id: "1",
      originLocationCode: params.originLocationCode,
      destinationLocationCode: params.destinationLocationCode,
      departureDateTimeRange: {
        date: params.departureDate,
      },
    },
  ];

  // Add return leg with different origin/destination if specified
  if (params.returnDate && params.returnOriginCode) {
    originDestinations.push({
      id: "2",
      originLocationCode: params.returnOriginCode,
      destinationLocationCode: params.returnDestinationCode || params.originLocationCode, // Return to specified destination or origin
      departureDateTimeRange: {
        date: params.returnDate,
      },
    });
  }

  const requestBody = {
    currencyCode: params.currencyCode || "NOK",
    originDestinations,
    travelers: Array.from({ length: params.adults }, (_, i) => ({
      id: String(i + 1),
      travelerType: "ADULT",
    })),
    sources: ["GDS"],
    searchCriteria: {
      maxFlightOffers: params.max || 50,
      flightFilters: {
        cabinRestrictions: [
          {
            cabin: "ECONOMY",
            coverage: "MOST_SEGMENTS",
            originDestinationIds: ["1", "2"],
          },
        ],
      },
    },
  };

  console.log("Open-jaw search request:", JSON.stringify(requestBody, null, 2));

  const response = await rateLimitedFetch(
    `${AMADEUS_BASE_URL}/v2/shopping/flight-offers`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Amadeus API POST error:", errorData);
    throw new Error(errorData?.errors?.[0]?.detail || "Flight search failed");
  }

  return response.json();
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
  DY: "Norwegian",
  KQ: "Kenya Airways",
  WB: "RwandAir",
  PW: "Precision Air",
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
