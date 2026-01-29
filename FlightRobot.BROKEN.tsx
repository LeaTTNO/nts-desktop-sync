// Minimal type for FlightInfo to satisfy TypeScript
import type { FlightInfo } from "../../contexts/FlightInfoContext";
import React, { useState, useEffect } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

import SectionDivider from "@/components/SectionDivider";
import FlightResultCard from "./FlightResultCard";
import { useTemplateStore } from "@/store/useTemplateStore";

import {
  Plane,
  Search,
  AlertCircle,
  Star,
  Clock,
  CalendarIcon,
  TrendingDown,
  Trophy,
  FileDown,
  RotateCcw,
} from "lucide-react";

import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { format, addYears } from "date-fns";
import { nb as nbFns, da as daFns } from "date-fns/locale";

import type { DayPickerLocale } from "react-day-picker";
import { nb as nbPicker, da as daPicker } from "react-day-picker/locale";

import { useLanguage } from "@/contexts/LanguageContext";
import {
  searchFlights,
  FlightOffer,
} from "@/lib/flightRobotClient";
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
        airlines: airlines,
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
  // Global state for slides (Zustand)
  const { addFlightSlide, slides } = useTemplateStore();
  // UX helpers: flight slide selection
  const hasFlightSlide = Array.isArray(slides) && slides.some(slide => typeof slide === "object" && slide.type === "flight");
  const selectedFlight = Array.isArray(slides)
    ? (slides.find(slide => typeof slide === "object" && slide.type === "flight") as { data?: any })?.data
    : undefined;
  const { language } = useLanguage();
  const t = translations[language] || translations.no;

  const defaultDeparture = language === "da" ? "CPH" : "OSL";
  const defaultReturnTo = language === "da" ? "CPH" : "OSL";

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

  const today = new Date();
  const maxDate = addYears(today, 1);

  const handleDepartureDateSelect = (date: Date | undefined) => {
    setDepartureDate(date);
    setDepartureDateOpen(false);
    if (date) {
      setTimeout(() => setReturnDateOpen(true), 100);
    }
  };

  const formatDateForApi = (date: Date | undefined): string => {
    if (!date) return "";
    return format(date, "yyyy-MM-dd");
  };

  const departureDateStr = formatDateForApi(departureDate);
  const returnDateStr = formatDateForApi(returnDate);

  const dateFnsLocale = language === "da" ? daFns : nbFns;
  const dayPickerLocale: Partial<DayPickerLocale> = language === "da" ? daPicker : nbPicker;
  const [hasSearched, setHasSearched] = useState(false);

  const [flexibleDates, setFlexibleDates] = useState(false);
  const [flexibleNights, setFlexibleNights] = useState(1);
  const [addNights, setAddNights] = useState(false);
  const [addNightsCount, setAddNightsCount] = useState(1);
  const [removeNights, setRemoveNights] = useState(false);
  const [removeNightsCount, setRemoveNightsCount] = useState(1);

  const [useDateInterval, setUseDateInterval] = useState(false);
  const [earliestDeparture, setEarliestDeparture] = useState<Date | undefined>(undefined);
  const [latestDeparture, setLatestDeparture] = useState<Date | undefined>(undefined);
  const [earliestDateOpen, setEarliestDateOpen] = useState(false);
  const [latestDateOpen, setLatestDateOpen] = useState(false);

  const { savedFlights, addFlight, clearFlights } = useFlightInfo();
  const [mainResults, setMainResults] = useState<MainResults>({ bestAndCheapest: null, cheapest: null });
  const [bestQualityResult, setBestQualityResult] = useState<ProcessedFlight | null>(null);
  const [cheapestExtendedResult, setCheapestExtendedResult] = useState<ProcessedFlight | null>(null);
  const [flexibleResult, setFlexibleResult] = useState<ProcessedFlight | null>(null);
  const [extendedStayResult, setExtendedStayResult] = useState<ProcessedFlight | null>(null);
  const [dateIntervalResult, setDateIntervalResult] = useState<ProcessedFlight | null>(null);

  // Nullstill-knapp
  function handleReset() {
    clearFlights();
    setMainResults({ bestAndCheapest: null, cheapest: null });
    setBestQualityResult(null);
    setCheapestExtendedResult(null);
    setFlexibleResult(null);
    setExtendedStayResult(null);
    setDateIntervalResult(null);
  }

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

// Save flight information as plain text to localStorage
// This will be used to populate placeholders in the "Flyinformation" template slide
function saveToPowerPointSingle(flight: ProcessedFlight, title: string) {
    try {
      const flightData: any = {
        period: departureDateStr && returnDateStr ? `${format(new Date(departureDateStr), "dd.MM.yyyy")} - ${format(new Date(returnDateStr), "dd.MM.yyyy")}` : '',
        passengers: passengers,
        flights: []
      };
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
      localStorage.setItem('flyinformasjon-data', JSON.stringify(flightData));
      localStorage.setItem('flyinformasjon-ready', 'true');
      toast.success(language === "no" ? "Flyinformasjon lagret! Gå til 'Bygg reiseprogram' og inkluder 'Flyinformasjon' i presentasjonen." : "Flyinformation gemt! Gå til 'Byg rejseprogram' og inkluder 'Flyinformation' i præsentationen.");
    } catch (error) {
      console.error("Flight save error:", error);
      toast.error(language === "no" ? "Feil ved lagring" : "Fejl ved gemning");
    }
  }

  // Old: Export all main results
  function saveToPowerPoint() {
    if (!mainResults.bestAndCheapest && !bestQualityResult && !cheapestExtendedResult) {
      toast.error(language === "no" ? "Ingen flyreiser å lagre" : "Ingen flyrejser at gemme");
      return;
    }
    try {
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
    return response;
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
    // Nullstill kun ved eksplisitt reset, ikke ved fane-bytte

    const currency = language === "da" ? "DKK" : "NOK";
    const pax = parseInt(passengers);

    try {
      // 1. MAIN SEARCH - Always runs, always shows 3 categories
      const mainOffers = await searchFlightsApi(departure, destination, returnFrom, returnTo, departureDateStr, returnDateStr, pax, currency);
      const processedFlights = processFlightOffers(mainOffers);
      const categories = categorizeFlights(processedFlights, t);

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
        if (cheapestFlex && cheapestFlex.price < basePrice) {
          setFlexibleResult(cheapestFlex);
        } else {
          setFlexibleResult(null);
        }
      }

      // 3. EXTENDED STAY SEARCH (add/remove nights)
      if (addNights && addNightsCount > 0) {
        let bestExtended: ProcessedFlight | null = null;
        const newRetDate = addDays(returnDateStr, addNightsCount);
        try {
          const offers = await searchFlightsApi(departure, destination, returnFrom, returnTo, departureDateStr, newRetDate, pax, currency);
          const processed = processFlightOffers(offers, { date: departureDateStr, nightsDiff: addNightsCount });
          const valid = processed.filter(f =>
            f.totalDurationMinutes <= MAX_EXTENDED_DURATION_HOURS * 60 && !f.hasNightFlight
          );
          for (const flight of valid) {
            if (!bestExtended || flight.price < bestExtended.price) {
              bestExtended = { ...flight, nightsDiff: addNightsCount };
            }
          }
        } catch (err) {
          console.log(`Extended stay search failed:`, err);
        }
        setExtendedStayResult(bestExtended);
      } else if (removeNights && removeNightsCount > 0) {
        let bestShorter: ProcessedFlight | null = null;
        const newRetDate = addDays(returnDateStr, -removeNightsCount);
        try {
          const offers = await searchFlightsApi(departure, destination, returnFrom, returnTo, departureDateStr, newRetDate, pax, currency);
          const processed = processFlightOffers(offers, { date: departureDateStr, nightsDiff: -removeNightsCount });
          const valid = processed.filter(f =>
            f.totalDurationMinutes <= MAX_EXTENDED_DURATION_HOURS * 60 && !f.hasNightFlight
          );
          for (const flight of valid) {
            if (!bestShorter || flight.price < bestShorter.price) {
              bestShorter = { ...flight, nightsDiff: -removeNightsCount };
            }
          }
        } catch (err) {
          console.log(`Shorter stay search failed:`, err);
        }
        setExtendedStayResult(bestShorter);
      } else {
        setExtendedStayResult(null);
      }

      // 4. DATE INTERVAL SEARCH (find cheapest in interval)
      if (useDateInterval && earliestDeparture && latestDeparture) {
        let bestInterval: ProcessedFlight | null = null;
        let bestDate: string | null = null;
        const start = new Date(earliestDeparture);
        const end = new Date(latestDeparture);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const depDateStr = formatDateForApi(d);
          const retDateStr = formatDateForApi(new Date(d.getTime() + calculateNights(departureDateStr, returnDateStr) * 24 * 60 * 60 * 1000));
          try {
            const offers = await searchFlightsApi(departure, destination, returnFrom, returnTo, depDateStr, retDateStr, pax, currency);
            const processed = processFlightOffers(offers, { date: depDateStr, nightsDiff: 0 });
            const valid = processed.filter(f =>
              f.totalDurationMinutes <= MAX_EXTENDED_DURATION_HOURS * 60 && !f.hasNightFlight
            );
            for (const flight of valid) {
              if (!bestInterval || flight.price < bestInterval.price) {
                bestInterval = { ...flight, searchDate: depDateStr };
                bestDate = depDateStr;
              }
            }
          } catch (err) {
            console.log(`Interval search for ${depDateStr} failed:`, err);
          }
        }
        setDateIntervalResult(bestInterval);
      } else {
        setDateIntervalResult(null);
      }
    } catch (err) {
      setError(t.error);
      console.error("Flight search error:", err);
    } finally {
      setIsSearching(false);
    }
  }

    return (
    <div className="flight-robot-root">
      {/* 1️⃣ Header / intro */}
      <SectionDivider label={t.title} />
      <div className="mb-2 text-center text-muted-foreground">{t.subtitle}</div>

      {/* 2️⃣ Søkeseksjon */}
      <Card className="mb-4">
        <CardContent className="pt-6 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>{t.from}</Label>
              <Select value={departure} onValueChange={setDeparture}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {departures.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.to}</Label>
              <Select value={destination} onValueChange={setDestination}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {destinations.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.returnFrom}</Label>
              <Select value={returnFrom} onValueChange={setReturnFrom}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {returnAirports.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.returnTo}</Label>
              <Select value={returnTo} onValueChange={setReturnTo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {departures.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.departDate}</Label>
              <Popover open={departureDateOpen} onOpenChange={setDepartureDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    {departureDate ? format(departureDate, "dd.MM.yyyy") : t.selectDeparture}
                    <CalendarIcon className="ml-2 h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-0">
                  <Calendar
                    mode="single"
                    selected={departureDate}
                    onSelect={handleDepartureDateSelect}
                    disabled={date => date < today || date > maxDate}
                    locale={dateFnsLocale}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>{t.returnDate}</Label>
              <Popover open={returnDateOpen} onOpenChange={setReturnDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    {returnDate ? format(returnDate, "dd.MM.yyyy") : t.selectDestination}
                    <CalendarIcon className="ml-2 h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-0">
                  <Calendar
                    mode="single"
                    selected={returnDate}
                    onSelect={date => { setReturnDate(date); setReturnDateOpen(false); }}
                    disabled={date => date < today || date > maxDate}
                    locale={dateFnsLocale}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>{t.passengers}</Label>
              <Input type="number" min={1} max={9} value={passengers} onChange={e => setPassengers(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Checkbox checked={flexibleDates} onCheckedChange={v => setFlexibleDates(!!v)} />
                <Label>{t.flexibleDates}±</Label>
                <Input type="number" min={1} max={7} value={flexibleNights} onChange={e => setFlexibleNights(Number(e.target.value))} className="w-16" />
                <span>{t.nights}</span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={addNights} onCheckedChange={v => setAddNights(!!v)} />
                <Label>{t.addNights}</Label>
                <Input type="number" min={1} max={7} value={addNightsCount} onChange={e => setAddNightsCount(Number(e.target.value))} className="w-16" />
                <span>{t.nightsExtra}</span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={removeNights} onCheckedChange={v => setRemoveNights(!!v)} />
                <Label>{t.removeNights}</Label>
                <Input type="number" min={1} max={7} value={removeNightsCount} onChange={e => setRemoveNightsCount(Number(e.target.value))} className="w-16" />
                <span>{t.nightsLess}</span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={useDateInterval} onCheckedChange={v => setUseDateInterval(!!v)} />
                <Label>{t.dateInterval}</Label>
                <Popover open={earliestDateOpen} onOpenChange={setEarliestDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-32 justify-start">
                      {earliestDeparture ? format(earliestDeparture, "dd.MM.yyyy") : t.earliestDeparture}
                      <CalendarIcon className="ml-2 h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="p-0">
                    <Calendar
                      mode="single"
                      selected={earliestDeparture}
                      onSelect={date => { setEarliestDeparture(date); setEarliestDateOpen(false); }}
                      disabled={date => date < today || date > maxDate}
                      locale={dateFnsLocale}
                    />
                  </PopoverContent>
                </Popover>
                <Popover open={latestDateOpen} onOpenChange={setLatestDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-32 justify-start">
                      {latestDeparture ? format(latestDeparture, "dd.MM.yyyy") : t.latestDeparture}
                      <CalendarIcon className="ml-2 h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="p-0">
                    <Calendar
                      mode="single"
                      selected={latestDeparture}
                      onSelect={date => { setLatestDeparture(date); setLatestDateOpen(false); }}
                      disabled={date => date < today || date > maxDate}
                      locale={dateFnsLocale}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          {/* 3️⃣ Handlinger */}
          <div className="flex gap-2 mt-6">
            <Button onClick={handleSearch} disabled={isSearching} className="flex-1">
              {isSearching ? t.searching : t.search}
              <Search className="ml-2 h-4 w-4" />
            </Button>
            <Button onClick={handleReset} variant="secondary" className="flex-1">
              <RotateCcw className="mr-2 h-4 w-4" />
              {t.copy}
            </Button>
          </div>
          {error && (
            <div className="mt-2 text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4️⃣ Resultater */}
      <div className="space-y-6">
        {mainResults.bestAndCheapest && (
          <FlightResultCard flight={mainResults.bestAndCheapest} title={t.bestAndCheapest} onSave={() => saveToPowerPointSingle(mainResults.bestAndCheapest, t.bestAndCheapest)} />
        )}
        {bestQualityResult && (
          <FlightResultCard flight={bestQualityResult} title={t.beste} onSave={() => saveToPowerPointSingle(bestQualityResult, t.beste)} />
        )}
        {cheapestExtendedResult && (
          <FlightResultCard flight={cheapestExtendedResult} title={t.cheapest} onSave={() => saveToPowerPointSingle(cheapestExtendedResult, t.cheapest)} />
        )}
        {flexibleResult && (
          <FlightResultCard flight={flexibleResult} title={t.cheaperFlexible} onSave={() => saveToPowerPointSingle(flexibleResult, t.cheaperFlexible)} />
        )}
        {extendedStayResult && (
          <FlightResultCard flight={extendedStayResult} title={t.bestExtended} onSave={() => saveToPowerPointSingle(extendedStayResult, t.bestExtended)} />
        )}
        {dateIntervalResult && (
          <FlightResultCard flight={dateIntervalResult} title={t.searchInInterval} onSave={() => saveToPowerPointSingle(dateIntervalResult, t.searchInInterval)} />
        )}
      </div>

      {/* 5️⃣ PowerPoint-handlinger */}
      <div className="flex gap-2 mt-8">
        <Button onClick={saveToPowerPoint} variant="outline">
          <FileDown className="mr-2 h-4 w-4" />
          {t.copy}
        </Button>
        <Button onClick={addFlightSlide} variant="outline" disabled={!mainResults.bestAndCheapest}>
          <Trophy className="mr-2 h-4 w-4" />
          {t.recommended}
        </Button>
      </div>
    </div>
  );

}
