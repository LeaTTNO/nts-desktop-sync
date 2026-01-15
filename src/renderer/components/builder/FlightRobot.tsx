import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import SectionDivider from "@/components/SectionDivider";
import { Plane, Search, AlertCircle, Star, Clock, CalendarIcon, TrendingDown, Trophy, FileDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, addYears } from "date-fns";
import { nb, da } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import { searchFlights, FlightOffer, airlineNames, airportNames } from "@/lib/amadeusClient";
import FlightResultCard from "./FlightResultCard";
import { useFlightInfo } from "@/contexts/FlightInfoContext";

// =============================================================================
// TYPES
// =============================================================================

interface ProcessedFlight {
  id: string;
  outbound: {
    departure: string;
    arrival: string;
    departureTime: string;
    arrivalTime: string;
    duration: string;
    stops: number;
    airlines: string[];
    segments: string;
  };
  inbound?: {
    departure: string;
    arrival: string;
    departureTime: string;
    arrivalTime: string;
    duration: string;
    stops: number;
    airlines: string[];
    segments: string;
  };
  price: number;
  currency: string;
  isRecommended: boolean;
  recommendReason?: string;
  rawOffer: FlightOffer;
  totalDurationMinutes: number;
  hasNightFlight: boolean;
  searchDate?: string;
  nightsDiff?: number;
}

interface MainResults {
  bestAndCheapest: ProcessedFlight | null;  // Best overall (good time + good price)
  cheapest: ProcessedFlight | null;         // Absolutely cheapest
}

interface ExtendedResults {
  best: ProcessedFlight | null;     // Best allowing night flights / longer time
  cheapest: ProcessedFlight | null; // Cheapest allowing night flights / longer time
}

// =============================================================================
// CONSTRAINTS (HARD LIMITS)
// =============================================================================

const MAX_STRICT_DURATION_HOURS = 22;    // Main results: max 22 hours
const MAX_EXTENDED_DURATION_HOURS = 25;  // Extended alternatives: max 25 hours
const NIGHT_START_HOUR = 0;              // Night period starts 00:00
const NIGHT_END_MINUTES = 355;           // Night period ends 05:55 (5*60 + 55 = 355 minutes)

// =============================================================================
// TRANSLATIONS
// =============================================================================

const translations = {
  no: {
    title: "FLYROBOTT",
    subtitle: "Finn beste flyruter til Tanzania",
    from: "Fra",
    to: "Til",
    returnFrom: "Retur fra",
    returnTo: "Retur til",
    departDate: "Avreisedato",
    returnDate: "Hjemreisedato",
    passengers: "Passasjerer",
    passenger: "passasjer",
    passengersPlural: "passasjerer",
    search: "Søk flyreiser",
    searching: "Søker...",
    selectDeparture: "Velg avreisested",
    selectDestination: "Velg destinasjon",
    recommended: "Anbefalt",
    bestAndCheapest: "Beste og billigste",
    cheapest: "Billigste",
    beste: "Beste",
    bestQualityDesc: "Beste reise etter varighet og forbindelser",
    cheapestWithFlexibility: "Billigste (opptil 25 timer)",
    bestExtended: "Beste (utvidet)",
    cheapestExtended: "Billigste (utvidet)",
    outbound: "UTREISE",
    inbound: "HJEMREISE",
    stops: "mellomlanding",
    stopsPlural: "mellomlandinger",
    direct: "Direkte",
    price: "Pris",
    perPerson: "per person",
    copy: "Kopier",
    copied: "Kopiert",
    noResults: "Ingen flyreiser funnet",
    error: "Kunne ikke søke fly",
    fillFields: "Fyll ut alle obligatoriske felt",
    duration: "Reisetid",
    flexibleDates: "Fleksible datoer (±",
    nights: "netter)",
    addNights: "Legg til ekstra netter (+",
    removeNights: "Fjern netter (-",
    nightsExtra: "netter ekstra)",
    nightsLess: "netter)",
    mainResults: "Hovedresultater",
    mainResultsDesc: "Max 22t reisetid, ingen nattfly (00:00-05:55)",
    extendedResults: "Utvidede alternativer",
    extendedResultsDesc: "Max 25t reisetid, tillater nattfly",
    cheaperFlexible: "Billigere med andre datoer",
    cheaperExtended: "Billigere med",
    extraNights: "ekstra netter",
    fewerNights: "færre netter",
    withBaggage: "Med bagasje",
    noMainResults: "Ingen reiser innenfor hovedkriterier",
    noExtendedResults: "Ingen utvidede alternativer",
    seats: "seter",
    layover: "mellomland.",
    dateInterval: "Dato-intervall",
    earliestDeparture: "Tidligste avreise",
    latestDeparture: "Seneste avreise",
    searchInInterval: "Søk billigste i periode",
    iataPlaceholder: "IATA (f.eks. OSL)",
    showDetails: "Vis detaljer",
    hideDetails: "Skjul detaljer",
  },
  da: {
    title: "FLYROBOT",
    subtitle: "Find bedste flyruter til Tanzania",
    from: "Fra",
    to: "Til",
    returnFrom: "Retur fra",
    returnTo: "Retur til",
    departDate: "Afrejsedato",
    returnDate: "Returdato",
    passengers: "Passagerer",
    passenger: "passager",
    passengersPlural: "passagerer",
    search: "Søg flyrejser",
    searching: "Søger...",
    selectDeparture: "Vælg afrejsested",
    selectDestination: "Vælg destination",
    recommended: "Anbefalet",
    bestAndCheapest: "Bedste og billigste",
    cheapest: "Billigste",
    beste: "Bedste",
    bestQualityDesc: "Bedste rejse efter varighed og forbindelser",
    cheapestWithFlexibility: "Billigste (op til 25 timer)",
    bestExtended: "Bedste (udvidet)",
    cheapestExtended: "Billigste (udvidet)",
    outbound: "UDREJSE",
    inbound: "HJEMREJSE",
    stops: "mellemlanding",
    stopsPlural: "mellemlandinger",
    direct: "Direkte",
    price: "Pris",
    perPerson: "per person",
    copy: "Kopier",
    copied: "Kopieret",
    noResults: "Ingen flyrejser fundet",
    error: "Kunne ikke søge fly",
    fillFields: "Udfyld alle obligatoriske felter",
    duration: "Rejsetid",
    flexibleDates: "Fleksible datoer (±",
    nights: "nætter)",
    addNights: "Tilføj ekstra nætter (+",
    removeNights: "Fjern nætter (-",
    nightsExtra: "nætter ekstra)",
    nightsLess: "nætter)",
    mainResults: "Hovedresultater",
    mainResultsDesc: "Max 22t rejsetid, ingen natfly (00:00-05:55)",
    extendedResults: "Udvidede alternativer",
    extendedResultsDesc: "Max 25t rejsetid, tillader natfly",
    cheaperFlexible: "Billigere med andre datoer",
    cheaperExtended: "Billigere med",
    extraNights: "ekstra nætter",
    fewerNights: "færre nætter",
    withBaggage: "Med bagage",
    noMainResults: "Ingen rejser inden for hovedkriterier",
    noExtendedResults: "Ingen udvidede alternativer",
    seats: "sæder",
    layover: "mellemland.",
    dateInterval: "Datointervall",
    earliestDeparture: "Tidligste afrejse",
    latestDeparture: "Seneste afrejse",
    searchInInterval: "Søg billigste i periode",
    iataPlaceholder: "IATA (f.eks. CPH)",
    showDetails: "Vis detaljer",
    hideDetails: "Skjul detaljer",
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatDuration(isoDuration: string): string {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return isoDuration;
  const hours = match[1] ? `${match[1]}t` : "";
  const minutes = match[2] ? ` ${match[2]}m` : "";
  return (hours + minutes).trim();
}

function formatTime(isoDateTime: string): string {
  return new Date(isoDateTime).toLocaleTimeString("no-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(isoDateTime: string, language: string): string {
  return new Date(isoDateTime).toLocaleDateString(language === "da" ? "da-DK" : "nb-NO", {
    day: "numeric",
    month: "short",
  });
}

function getTotalMinutes(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return 9999;
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  return hours * 60 + minutes;
}

/**
 * Check if a time falls in the night period (00:00 - 05:55)
 */
function isNightTime(dateTimeStr: string): boolean {
  const date = new Date(dateTimeStr);
  const timeInMinutes = date.getHours() * 60 + date.getMinutes();
  return timeInMinutes >= NIGHT_START_HOUR && timeInMinutes < NIGHT_END_MINUTES;
}

/**
 * Check if flight has problematic night arrival/departure at CRITICAL ENDPOINTS ONLY:
 * BLOCKED: Arrival at final destination (JRO/ZNZ/DAR) between 00:00-05:55
 * BLOCKED: Departure from origin on return leg (JRO/ZNZ/DAR) between 00:00-05:55
 * OK: Night layovers in between are allowed (ADD, DOH, AMS, etc)
 */
function hasProblematicNightFlight(offer: FlightOffer): boolean {
  // Check OUTBOUND: arrival at final destination in Africa
  const outboundItinerary = offer.itineraries[0];
  const lastOutboundSegment = outboundItinerary.segments[outboundItinerary.segments.length - 1];
  const outboundArrivalTime = lastOutboundSegment.arrival.at;
  
  if (isNightTime(outboundArrivalTime)) {
    return true; // BLOCKED: arrives at destination during night
  }
  
  // Check RETURN: departure from origin in Africa
  if (offer.itineraries.length > 1) {
    const returnItinerary = offer.itineraries[1];
    const firstReturnSegment = returnItinerary.segments[0];
    const returnDepartureTime = firstReturnSegment.departure.at;
    
    if (isNightTime(returnDepartureTime)) {
      return true; // BLOCKED: departs from return origin during night
    }
  }
  
  return false; // OK: no problematic night flights at critical endpoints
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function calculateNights(depDate: string, retDate: string): number {
  const dep = new Date(depDate);
  const ret = new Date(retDate);
  return Math.round((ret.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24));
}

// =============================================================================
// FLIGHT PROCESSING
// =============================================================================

function processFlightOffers(
  offers: FlightOffer[], 
  searchInfo?: { date: string; nightsDiff: number }
): ProcessedFlight[] {
  return offers.map((offer): ProcessedFlight => {
    const outboundItinerary = offer.itineraries[0];
    const inboundItinerary = offer.itineraries[1];

    const processItinerary = (itinerary: typeof outboundItinerary) => {
      const firstSeg = itinerary.segments[0];
      const lastSeg = itinerary.segments[itinerary.segments.length - 1];
      const airlines = [...new Set(itinerary.segments.map(s => s.carrierCode))];
      const stops = itinerary.segments.length - 1;

      const segmentDetails = itinerary.segments.map(seg => 
        `${seg.carrierCode}${seg.number}`
      ).join(" → ");

      return {
        departure: firstSeg.departure.iataCode,
        arrival: lastSeg.arrival.iataCode,
        departureTime: firstSeg.departure.at,
        arrivalTime: lastSeg.arrival.at,
        duration: itinerary.duration,
        stops,
        airlines: airlines.map(code => airlineNames[code] || code),
        segments: segmentDetails,
      };
    };

    const outDuration = getTotalMinutes(outboundItinerary.duration);
    const inDuration = inboundItinerary ? getTotalMinutes(inboundItinerary.duration) : 0;
    
    // Max duration of single leg (not sum) for filtering
    const maxSingleLegDuration = Math.max(outDuration, inDuration);

    return {
      id: offer.id,
      outbound: processItinerary(outboundItinerary),
      inbound: inboundItinerary ? processItinerary(inboundItinerary) : undefined,
      price: parseFloat(offer.price.grandTotal),
      currency: offer.price.currency,
      isRecommended: false,
      rawOffer: offer,
      totalDurationMinutes: maxSingleLegDuration, // Use max single leg, not sum
      hasNightFlight: hasProblematicNightFlight(offer),
      searchDate: searchInfo?.date,
      nightsDiff: searchInfo?.nightsDiff,
    };
  });
}

/**
 * Calculate a quality score for flights (lower is better)
 * Prioritizes: 1) Duration, 2) Connections, 3) Price
 */
function calculateFlightScore(flight: ProcessedFlight): number {
  const durationScore = flight.totalDurationMinutes; // Raw minutes
  const stopsScore = (flight.outbound.stops + (flight.inbound?.stops || 0)) * 120; // 2 hours penalty per stop
  const priceScore = flight.price * 0.1; // Price has lower weight
  return durationScore + stopsScore + priceScore;
}

/**
 * Filter and categorize flights according to user's exact specifications:
 * ALWAYS returns 3 main categories:
 * 1. Best and cheapest (≤22h, no night flights) 
 * 2. Best overall by quality (≤22h, no night flights)
 * 3. Cheapest extended (≤25h, allows night flights)
 * 4. Cheapest with night flights (any duration, but has night departure/arrival)
 */
function categorizeFlights(flights: ProcessedFlight[], t: typeof translations.no): {
  bestAndCheapest: ProcessedFlight | null;
  bestQuality: ProcessedFlight | null;
  cheapestExtended: ProcessedFlight | null;
} {
  // HARD FILTER: Never show flights over 25 hours
  const validFlights = flights.filter(f => 
    f.totalDurationMinutes <= MAX_EXTENDED_DURATION_HOURS * 60
  );

  if (validFlights.length === 0) {
    return { bestAndCheapest: null, bestQuality: null, cheapestExtended: null };
  }

  // Category 1 & 2: Strict flights (≤22h, no night flights)
  const strictFlights = validFlights.filter(f => 
    f.totalDurationMinutes <= MAX_STRICT_DURATION_HOURS * 60 && !f.hasNightFlight
  );

  // Score strict flights (lower = better: prioritize duration, then connections, then price)
  const scoredStrict = strictFlights
    .map(f => ({ ...f, score: calculateFlightScore(f) }))
    .sort((a, b) => a.score - b.score);

  // RESULT 1: Best and cheapest (combines best score with lowest price among strict)
  const bestAndCheapest = scoredStrict[0] ? { ...scoredStrict[0], isRecommended: true } : null;

  // RESULT 2: Best overall by quality alone (different from Result 1, or second-best if only one)
  let bestQuality: ProcessedFlight | null = null;
  if (strictFlights.length > 1) {
    // Find first flight with different ID
    bestQuality = scoredStrict.find(f => f.id !== bestAndCheapest?.id) || null;
  }

  // RESULT 3: Cheapest extended (≤25h, allows night flights) - can be the same as #1 if no extended flights
  const sortedByPrice = [...validFlights].sort((a, b) => a.price - b.price);
  const cheapestExtended = sortedByPrice[0] ? sortedByPrice[0] : null;

  return {
    bestAndCheapest,
    bestQuality,
    cheapestExtended,
  };
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function FlightRobot() {
  const { language } = useLanguage();
  const t = translations[language] || translations.no;

  // Default routes based on language
  const defaultDeparture = language === "da" ? "CPH" : "OSL";
  const defaultReturnTo = language === "da" ? "CPH" : "OSL";

  // State
  const [departure, setDeparture] = useState(defaultDeparture);
  const [destination, setDestination] = useState("JRO");
  const [returnFrom, setReturnFrom] = useState("ZNZ");
  const [returnTo, setReturnTo] = useState(defaultReturnTo);
  const [departureDate, setDepartureDate] = useState<Date | undefined>(undefined);
  const [returnDate, setReturnDate] = useState<Date | undefined>(undefined);
  const [departureDateOpen, setDepartureDateOpen] = useState(false);
  const [returnDateOpen, setReturnDateOpen] = useState(false);
  const [passengers, setPassengers] = useState("1");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Calendar limits - only allow 1 year ahead
  const today = new Date();
  const maxDate = addYears(today, 1);

  // Handle departure date selection - auto open return date starting from same date
  const handleDepartureDateSelect = (date: Date | undefined) => {
    setDepartureDate(date);
    setDepartureDateOpen(false);
    if (date) {
      // Always open return date popover after selecting departure
      // Set return date calendar to start from selected departure date
      setTimeout(() => setReturnDateOpen(true), 100);
    }
  };

  // Format date for API (YYYY-MM-DD)
  const formatDateForApi = (date: Date | undefined): string => {
    if (!date) return "";
    return format(date, "yyyy-MM-dd");
  };

  const departureDateStr = formatDateForApi(departureDate);
  const returnDateStr = formatDateForApi(returnDate);
  
  const dateLocale = language === "da" ? da : nb;
  const [hasSearched, setHasSearched] = useState(false);

  // Flexible options
  const [flexibleDates, setFlexibleDates] = useState(false);
  const [flexibleNights, setFlexibleNights] = useState(1);
  const [addNights, setAddNights] = useState(false);
  const [addNightsCount, setAddNightsCount] = useState(1);
  const [removeNights, setRemoveNights] = useState(false);
  const [removeNightsCount, setRemoveNightsCount] = useState(1);
  
  // Date interval option
  const [useDateInterval, setUseDateInterval] = useState(false);
  const [earliestDeparture, setEarliestDeparture] = useState<Date | undefined>(undefined);
  const [latestDeparture, setLatestDeparture] = useState<Date | undefined>(undefined);
  const [earliestDateOpen, setEarliestDateOpen] = useState(false);
  const [latestDateOpen, setLatestDateOpen] = useState(false);

  // Results
  const [mainResults, setMainResults] = useState<MainResults>({ bestAndCheapest: null, cheapest: null });
  const [extendedResults, setExtendedResults] = useState<ExtendedResults>({ best: null, cheapest: null });
  const [bestQualityResult, setBestQualityResult] = useState<ProcessedFlight | null>(null);
  const [cheapestExtendedResult, setCheapestExtendedResult] = useState<ProcessedFlight | null>(null);
  const [flexibleResult, setFlexibleResult] = useState<ProcessedFlight | null>(null);
  const [extendedStayResult, setExtendedStayResult] = useState<ProcessedFlight | null>(null);
  const [dateIntervalResult, setDateIntervalResult] = useState<ProcessedFlight | null>(null);

  // Update departure and return when language changes
  useEffect(() => {
    setDeparture(language === "da" ? "CPH" : "OSL");
    setReturnTo(language === "da" ? "CPH" : "OSL");
  }, [language]);

  // Options
  const departures = [
    { value: "OSL", label: "Oslo (OSL)" },
    { value: "CPH", label: "København (CPH)" },
    { value: "ARN", label: "Stockholm (ARN)" },
  ];

  const destinations = [
    { value: "JRO", label: "Kilimanjaro (JRO)" },
    { value: "DAR", label: "Dar es Salaam (DAR)" },
    { value: "ZNZ", label: "Zanzibar (ZNZ)" },
  ];

  const returnAirports = [
    { value: "ZNZ", label: "Zanzibar (ZNZ)" },
    { value: "JRO", label: "Kilimanjaro (JRO)" },
    { value: "DAR", label: "Dar es Salaam (DAR)" },
  ];

  const formatDate = (dateStr: string) => formatDateShort(dateStr, language);
  const { addFlight } = useFlightInfo();

  // Save flight information as plain text to localStorage
  // This will be used to populate placeholders in the "Flyinformation" template slide
  function saveToPowerPoint() {
    if (!mainResults.bestAndCheapest && !bestQualityResult && !cheapestExtendedResult) {
      toast.error(language === "no" ? "Ingen flyreiser å lagre" : "Ingen flyrejser at gemme");
      return;
    }

    try {
      // Build flight information as structured data
      const flightData: any = {
        period: departureDateStr && returnDateStr ? `${format(new Date(departureDateStr), "dd.MM.yyyy")} - ${format(new Date(returnDateStr), "dd.MM.yyyy")}` : '',
        passengers: passengers,
        flights: []
      };

      const addFlightInfo = (flight: ProcessedFlight, title: string) => {
        flightData.flights.push({
          title,
          price: `${flight.price} ${flight.currency}`,
          outbound: {
            route: `${flight.outbound.departure} → ${flight.outbound.arrival}`,
            departure: `${formatTime(flight.outbound.departureTime)} (${formatDate(flight.outbound.departureTime)})`,
            arrival: `${formatTime(flight.outbound.arrivalTime)} (${formatDate(flight.outbound.arrivalTime)})`,
            duration: formatDuration(flight.outbound.duration),
            stops: flight.outbound.stops === 0 ? 'Direkte' : `${flight.outbound.stops}`
          },
          inbound: flight.inbound ? {
            route: `${flight.inbound.departure} → ${flight.inbound.arrival}`,
            departure: `${formatTime(flight.inbound.departureTime)} (${formatDate(flight.inbound.departureTime)})`,
            arrival: `${formatTime(flight.inbound.arrivalTime)} (${formatDate(flight.inbound.arrivalTime)})`,
            duration: formatDuration(flight.inbound.duration),
            stops: flight.inbound.stops === 0 ? 'Direkte' : `${flight.inbound.stops}`
          } : null
        });
      };

      if (mainResults.bestAndCheapest) {
        addFlightInfo(mainResults.bestAndCheapest, t.bestAndCheapest);
      }
      if (bestQualityResult && bestQualityResult.id !== mainResults.bestAndCheapest?.id) {
        addFlightInfo(bestQualityResult, t.beste);
      }
      if (cheapestExtendedResult && cheapestExtendedResult.id !== mainResults.bestAndCheapest?.id) {
        addFlightInfo(cheapestExtendedResult, t.cheapest);
      }

      // Store flight data in localStorage
      localStorage.setItem('flyinformasjon-data', JSON.stringify(flightData));
      localStorage.setItem('flyinformasjon-ready', 'true');
      
      toast.success(language === "no" ? "Flyinformasjon lagret! Gå til 'Bygg reiseprogram' og inkluder 'Flyinformasjon' i presentasjonen." : "Flyinformation gemt! Gå til 'Byg rejseprogram' og inkluder 'Flyinformation' i præsentationen.");
    } catch (error) {
      console.error("Flight save error:", error);
      toast.error(language === "no" ? "Feil ved lagring" : "Fejl ved gemning");
    }
  }

  // Search API call - handles both round-trip and open-jaw (different return airport)
  async function searchFlightsApi(
    dep: string, 
    dest: string,
    retFrom: string,
    retTo: string,
    depDate: string, 
    retDate: string, 
    pax: number,
    currency: string
  ): Promise<FlightOffer[]> {
    const response = await searchFlights({
      originLocationCode: dep,
      destinationLocationCode: dest,
      departureDate: depDate,
      returnDate: retDate,
      returnOriginCode: retFrom, // For open-jaw: fly to dest, return from retFrom
      returnDestinationCode: retTo, // For open-jaw: return to retTo (e.g., OSL or CPH)
      adults: pax,
      currencyCode: currency,
      max: 50,
    });
    return response.data || [];
  }

  // Main search handler
  async function handleSearch() {
    if (!departure || !departureDateStr || !returnDateStr) {
      toast.error(t.fillFields);
      return;
    }

    setIsSearching(true);
    setError(null);
    setHasSearched(true);
    setMainResults({ bestAndCheapest: null, cheapest: null });
    setBestQualityResult(null);
    setCheapestExtendedResult(null);
    setExtendedResults({ best: null, cheapest: null });
    setFlexibleResult(null);
    setExtendedStayResult(null);
    setDateIntervalResult(null);

    const currency = language === "da" ? "DKK" : "NOK";
    const pax = parseInt(passengers);

    try {
      // 1. MAIN SEARCH - Always runs, always shows 3 categories
      const mainOffers = await searchFlightsApi(departure, destination, returnFrom, returnTo, departureDateStr, returnDateStr, pax, currency);
      const processedFlights = processFlightOffers(mainOffers);
      const categories = categorizeFlights(processedFlights, t);
      
      // Set all 3 mandatory categories
      setMainResults({ bestAndCheapest: categories.bestAndCheapest, cheapest: null });
      setBestQualityResult(categories.bestQuality);
      setCheapestExtendedResult(categories.cheapestExtended);

      const basePrice = categories.bestAndCheapest?.price || Infinity;

      // 2. FLEXIBLE DATES SEARCH (±X days, same number of nights) - Sequential to avoid rate limiting
      if (flexibleDates && flexibleNights > 0) {
        let cheapestFlex: ProcessedFlight | null = null;
        
        for (let i = -flexibleNights; i <= flexibleNights; i++) {
          if (i === 0) continue;
          const newDepDate = addDays(departureDateStr, i);
          const newRetDate = addDays(returnDateStr, i);
          
          try {
            const offers = await searchFlightsApi(departure, destination, returnFrom, returnTo, newDepDate, newRetDate, pax, currency);
            const processed = processFlightOffers(offers, { date: newDepDate, nightsDiff: 0 });
            // Allow longer flights with night layovers, but exclude problematic endpoints
            const valid = processed.filter(f => 
              f.totalDurationMinutes <= MAX_EXTENDED_DURATION_HOURS * 60 && !f.hasNightFlight
            );
            
            for (const flight of valid) {
              if (!cheapestFlex || flight.price < cheapestFlex.price) {
                cheapestFlex = { ...flight, searchDate: newDepDate };
              }
            }
          } catch (err) {
            console.log(`Flex search for ${newDepDate} failed:`, err);
          }
        }

        // Only show if cheaper than original
        if (cheapestFlex && cheapestFlex.price < basePrice) {
          setFlexibleResult({ ...cheapestFlex, recommendReason: t.cheapest });
        }
      }

      // 3A. ADD NIGHTS SEARCH (extend trip if cheaper)
      if (addNights && addNightsCount > 0) {
        let cheapestAdd: ProcessedFlight | null = null;
        
        for (let i = 1; i <= addNightsCount; i++) {
          const newRetDate = addDays(returnDateStr, i);
          
          try {
            const offers = await searchFlightsApi(departure, destination, returnFrom, returnTo, departureDateStr, newRetDate, pax, currency);
            const processed = processFlightOffers(offers, { date: departureDateStr, nightsDiff: i });
            const valid = processed.filter(f => 
              f.totalDurationMinutes <= MAX_EXTENDED_DURATION_HOURS * 60 && !f.hasNightFlight
            );
            
            for (const flight of valid) {
              flight.nightsDiff = i;
              if (!cheapestAdd || flight.price < cheapestAdd.price) {
                cheapestAdd = flight;
              }
            }
          } catch (err) {
            console.log(`Add nights search for ${newRetDate} failed:`, err);
          }
        }

        // Only show if cheaper than original
        if (cheapestAdd && cheapestAdd.price < basePrice) {
          setExtendedStayResult({ ...cheapestAdd, recommendReason: t.cheapest });
        }
      }

      // 3B. REMOVE NIGHTS SEARCH (shorten trip if cheaper)
      if (removeNights && removeNightsCount > 0) {
        let cheapestRemove: ProcessedFlight | null = null;
        
        for (let i = 1; i <= removeNightsCount; i++) {
          const newRetDate = addDays(returnDateStr, -i);
          
          try {
            const offers = await searchFlightsApi(departure, destination, returnFrom, returnTo, departureDateStr, newRetDate, pax, currency);
            const processed = processFlightOffers(offers, { date: departureDateStr, nightsDiff: -i });
            const valid = processed.filter(f => 
              f.totalDurationMinutes <= MAX_EXTENDED_DURATION_HOURS * 60 && !f.hasNightFlight
            );
            
            for (const flight of valid) {
              flight.nightsDiff = -i;
              if (!cheapestRemove || flight.price < cheapestRemove.price) {
                cheapestRemove = flight;
              }
            }
          } catch (err) {
            console.log(`Remove nights search for ${newRetDate} failed:`, err);
          }
        }

        // Only show if cheaper than original - store separately
        if (cheapestRemove && cheapestRemove.price < basePrice) {
          // If we already have addNights result, keep the cheapest one
          if (!extendedStayResult || cheapestRemove.price < extendedStayResult.price) {
            setExtendedStayResult({ ...cheapestRemove, recommendReason: t.cheapest });
          }
        }
      }

      // 4. DATE INTERVAL SEARCH (search all dates in range with same number of nights)
      if (useDateInterval && earliestDeparture && latestDeparture) {
        const tripNights = calculateNights(departureDateStr, returnDateStr);
        let cheapestInterval: ProcessedFlight | null = null;
        
        // Calculate number of days in the interval
        const startDate = new Date(earliestDeparture);
        const endDate = new Date(latestDeparture);
        const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        for (let i = 0; i <= daysDiff; i++) {
          const searchDepDate = format(new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
          const searchRetDate = addDays(searchDepDate, tripNights);
          
          // Skip if this is the original search date
          if (searchDepDate === departureDateStr) continue;
          
          try {
            const offers = await searchFlightsApi(departure, destination, returnFrom, returnTo, searchDepDate, searchRetDate, pax, currency);
            const processed = processFlightOffers(offers, { date: searchDepDate, nightsDiff: 0 });
            // Allow longer flights with night layovers, but exclude problematic endpoints
            const valid = processed.filter(f => 
              f.totalDurationMinutes <= MAX_EXTENDED_DURATION_HOURS * 60 && !f.hasNightFlight
            );
            
            for (const flight of valid) {
              if (!cheapestInterval || flight.price < cheapestInterval.price) {
                cheapestInterval = { ...flight, searchDate: searchDepDate };
              }
            }
          } catch (err) {
            console.log(`Interval search for ${searchDepDate} failed:`, err);
          }
        }

        // Only show if cheaper than original
        if (cheapestInterval && cheapestInterval.price < basePrice) {
          setDateIntervalResult({ ...cheapestInterval, recommendReason: t.searchInInterval });
        }
      }

      // Toast notification
      if (categories.bestAndCheapest || categories.bestQuality || categories.cheapestExtended) {
        toast.success(language === "no" ? "Flyreiser funnet!" : "Flyrejser fundet!");
      } else {
        toast.info(t.noResults);
      }

    } catch (err) {
      console.error("Flight search error:", err);
      setError(err instanceof Error ? err.message : t.error);
      toast.error(t.error);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* Search Form */}
      <Card className="border-border/50">
        <CardContent className="pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Departure */}
            <div className="space-y-1">
              <Label>{t.from}</Label>
              <Select value={departure} onValueChange={setDeparture}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={t.selectDeparture} />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {departures.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Destination */}
            <div className="space-y-1">
              <Label>{t.to}</Label>
              <Select value={destination} onValueChange={setDestination}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={t.selectDestination} />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {destinations.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Passengers */}
            <div className="space-y-1">
              <Label>{t.passengers}</Label>
              <Select value={passengers} onValueChange={setPassengers}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {[1,2,3,4,5,6,7,8,9].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
            {/* Return From */}
            <div className="space-y-1">
              <Label>{t.returnFrom}</Label>
              <Select value={returnFrom} onValueChange={setReturnFrom}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {returnAirports.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Return To - Free IATA input */}
            <div className="space-y-1">
              <Label>{t.returnTo}</Label>
              <Input
                value={returnTo}
                onChange={(e) => setReturnTo(e.target.value.toUpperCase().slice(0, 3))}
                placeholder={t.iataPlaceholder}
                className="uppercase"
                maxLength={3}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">

            {/* Departure Date */}
            <div className="space-y-1">
              <Label>{t.departDate}</Label>
              <Popover open={departureDateOpen} onOpenChange={setDepartureDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-background",
                      !departureDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {departureDate ? format(departureDate, "PPP", { locale: dateLocale }) : <span>Velg dato</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-background !z-50 font-sans text-base text-foreground" align="start" side="bottom">
                  <Calendar
                    mode="single"
                    selected={departureDate}
                    onSelect={handleDepartureDateSelect}
                    initialFocus
                    locale={dateLocale}
                    className="pointer-events-auto"
                    disabled={(date) => date < today || date > maxDate}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Return Date */}
            <div className="space-y-1">
              <Label>{t.returnDate}</Label>
              <Popover open={returnDateOpen} onOpenChange={setReturnDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-background",
                      !returnDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {returnDate ? format(returnDate, "PPP", { locale: dateLocale }) : <span>Velg dato</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-background !z-50 font-sans text-base text-foreground" align="start" side="bottom">
                  <Calendar
                    mode="single"
                    selected={returnDate}
                    onSelect={(date) => {
                      setReturnDate(date);
                      setReturnDateOpen(false);
                    }}
                    initialFocus
                    locale={dateLocale}
                    className="pointer-events-auto"
                    defaultMonth={departureDate}
                    disabled={(date) => {
                      if (departureDate && date < departureDate) return true;
                      if (date > maxDate) return true;
                      return false;
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Flexible Options */}
          <div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Flexible Dates (same trip length) */}
            <div className="flex items-center gap-3">
              <Checkbox 
                id="flexibleDates" 
                checked={flexibleDates}
                onCheckedChange={(checked) => setFlexibleDates(checked === true)}
              />
              <Label htmlFor="flexibleDates" className="flex items-center gap-2 cursor-pointer">
                {t.flexibleDates}
                <Select value={String(flexibleNights)} onValueChange={(v) => setFlexibleNights(parseInt(v))}>
                  <SelectTrigger className="w-16 h-8 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {[1, 2, 3, 4, 5, 7].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {t.nights}
              </Label>
            </div>

            {/* Add Extra Nights */}
            <div className="flex items-center gap-3">
              <Checkbox 
                id="addNights" 
                checked={addNights}
                onCheckedChange={(checked) => setAddNights(checked === true)}
              />
              <Label htmlFor="addNights" className="flex items-center gap-2 cursor-pointer">
                {t.addNights}
                <Select value={String(addNightsCount)} onValueChange={(v) => setAddNightsCount(parseInt(v))}>
                  <SelectTrigger className="w-16 h-8 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {[1, 2, 3, 4, 5, 7].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {t.nightsExtra}
              </Label>
            </div>

            {/* Remove Nights */}
            <div className="flex items-center gap-3">
              <Checkbox 
                id="removeNights" 
                checked={removeNights}
                onCheckedChange={(checked) => setRemoveNights(checked === true)}
              />
              <Label htmlFor="removeNights" className="flex items-center gap-2 cursor-pointer">
                {t.removeNights}
                <Select value={String(removeNightsCount)} onValueChange={(v) => setRemoveNightsCount(parseInt(v))}>
                  <SelectTrigger className="w-16 h-8 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {[1, 2, 3, 4, 5, 7].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {t.nightsLess}
              </Label>
            </div>
            
            {/* Date Interval Option */}
            <div className="col-span-1 md:col-span-2 flex flex-wrap items-center gap-3 pt-2 border-t border-border/30">
              <Checkbox 
                id="dateInterval" 
                checked={useDateInterval}
                onCheckedChange={(checked) => setUseDateInterval(checked === true)}
              />
              <Label htmlFor="dateInterval" className="cursor-pointer">
                {t.dateInterval}:
              </Label>
              
              {useDateInterval && (
                <div className="flex flex-wrap items-center gap-2">
                  <Popover open={earliestDateOpen} onOpenChange={setEarliestDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "min-w-[170px] w-auto justify-start text-left font-normal bg-background",
                          !earliestDeparture && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {earliestDeparture ? format(earliestDeparture, "dd MMM", { locale: dateLocale }) : t.earliestDeparture}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-background !z-50 font-sans text-base text-foreground" align="start" side="bottom">
                      <Calendar
                        mode="single"
                        selected={earliestDeparture}
                        onSelect={(date) => {
                          setEarliestDeparture(date);
                          setEarliestDateOpen(false);
                          if (date) setTimeout(() => setLatestDateOpen(true), 100);
                        }}
                        initialFocus
                        locale={dateLocale}
                        className="pointer-events-auto"
                        disabled={(date) => date < new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <span className="text-muted-foreground">→</span>
                  
                  <Popover open={latestDateOpen} onOpenChange={setLatestDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "min-w-[180px] w-auto justify-start text-left font-normal bg-background",
                          !latestDeparture && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {latestDeparture ? format(latestDeparture, "dd MMM", { locale: dateLocale }) : t.latestDeparture}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-background !z-50 font-sans text-base text-foreground" align="start" side="bottom">
                      <Calendar
                        mode="single"
                        selected={latestDeparture}
                        onSelect={(date) => {
                          setLatestDeparture(date);
                          setLatestDateOpen(false);
                        }}
                        initialFocus
                        locale={dateLocale}
                        className="pointer-events-auto"
                        defaultMonth={earliestDeparture}
                        disabled={(date) => earliestDeparture ? date < earliestDeparture : date < new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </div>

          {/* Search Button */}
          <div className="mt-2 grid grid-cols-1 gap-2">
            <Button 
              onClick={handleSearch} 
              disabled={isSearching}
              className="w-full"
              size="lg"
            >
              {isSearching ? (
                <>
                  <Search className="mr-2 h-4 w-4 animate-spin" />
                  {t.searching}
                </>
              ) : (
                <>
                  <Plane className="mr-2 h-4 w-4" />
                  {t.search}
                </>
              )}
            </Button>
            
            {/* PowerPoint Export Button */}
            {(mainResults.bestAndCheapest || bestQualityResult || cheapestExtendedResult) && (
              <Button 
                onClick={saveToPowerPoint}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <FileDown className="mr-2 h-4 w-4" />
                {language === "no" ? "Lagre til presentasjon" : "Gem til præsentation"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MAIN RESULTS - ALWAYS SHOW ALL 3 CATEGORIES (≤22h/≤25h, varying night restrictions) */}
      {hasSearched && (mainResults.bestAndCheapest || bestQualityResult || cheapestExtendedResult) && (
        <div className="space-y-6">
          {/* CATEGORY 1: Best and Cheapest (≤22h, no night) */}
          {mainResults.bestAndCheapest && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-primary fill-primary" />
                <div>
                  <h3 className="font-semibold text-foreground">{t.bestAndCheapest}</h3>
                  <p className="text-xs text-muted-foreground">{t.mainResultsDesc}</p>
                </div>
              </div>
              <FlightResultCard 
                flight={mainResults.bestAndCheapest} 
                language={language}
                translations={t}
                formatTime={formatTime}
                formatDate={formatDate}
                formatDuration={formatDuration}
              />
            </div>
          )}

          {/* CATEGORY 2: Best by Quality (≤22h, no night) */}
          {bestQualityResult && bestQualityResult.id !== mainResults.bestAndCheapest?.id && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                <div>
                  <h3 className="font-semibold text-foreground">{t.beste}</h3>
                  <p className="text-xs text-muted-foreground">{t.bestQualityDesc || "Best overall flight based on duration and connections"}</p>
                </div>
              </div>
              <FlightResultCard 
                flight={bestQualityResult} 
                language={language}
                translations={t}
                formatTime={formatTime}
                formatDate={formatDate}
                formatDuration={formatDuration}
              />
            </div>
          )}

          {/* CATEGORY 3: Cheapest Extended (≤25h, allows night flights) */}
          {cheapestExtendedResult && cheapestExtendedResult.id !== mainResults.bestAndCheapest?.id && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-green-500" />
                <div>
                  <h3 className="font-semibold text-foreground">{t.cheapest}</h3>
                  <p className="text-xs text-muted-foreground">{t.cheapestWithFlexibility || "Cheapest option up to 25 hours"}</p>
                </div>
              </div>
              <FlightResultCard 
                flight={cheapestExtendedResult} 
                language={language}
                translations={t}
                formatTime={formatTime}
                formatDate={formatDate}
                formatDuration={formatDuration}
              />
            </div>
          )}
        </div>
      )}

      {/* FLEXIBLE DATE RESULT */}
      {flexibleResult && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-500" />
            <div>
              <h3 className="font-semibold text-foreground">{t.cheaperFlexible}</h3>
              {flexibleResult.searchDate && (
                <p className="text-xs text-muted-foreground">
                  {formatDate(flexibleResult.searchDate + 'T00:00:00')}
                </p>
              )}
            </div>
          </div>
          <FlightResultCard 
            flight={flexibleResult} 
            language={language}
            translations={t}
            formatTime={formatTime}
            formatDate={formatDate}
            formatDuration={formatDuration}
          />
        </div>
      )}

      {/* EXTENDED STAY RESULT */}
      {extendedStayResult && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-green-500" />
            <div>
              <h3 className="font-semibold text-foreground">
                {t.cheaperExtended} {Math.abs(extendedStayResult.nightsDiff || 0)} {(extendedStayResult.nightsDiff || 0) > 0 ? t.extraNights : t.fewerNights}
              </h3>
            </div>
          </div>
          <FlightResultCard 
            flight={extendedStayResult} 
            language={language}
            translations={t}
            formatTime={formatTime}
            formatDate={formatDate}
            formatDuration={formatDuration}
          />
        </div>
      )}

      {/* DATE INTERVAL RESULT */}
      {dateIntervalResult && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-green-500" />
            <div>
              <h3 className="font-semibold text-foreground">{t.searchInInterval}</h3>
              {dateIntervalResult.searchDate && (
                <p className="text-xs text-muted-foreground">
                  {formatDate(dateIntervalResult.searchDate + 'T00:00:00')}
                </p>
              )}
            </div>
          </div>
          <FlightResultCard 
            flight={dateIntervalResult} 
            language={language}
            translations={t}
            formatTime={formatTime}
            formatDate={formatDate}
            formatDuration={formatDuration}
          />
        </div>
      )}

      {hasSearched && !mainResults.bestAndCheapest && !bestQualityResult && !cheapestExtendedResult && !isSearching && !error && (
        <Card className="border-border/50">
          <CardContent className="pt-6 text-center text-muted-foreground">
            {t.noResults}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
