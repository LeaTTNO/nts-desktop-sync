/**
 * ⚠️ LOCKED FILE
 * Farewise integration is working.
 * DO NOT modify searchFlightsApi, date handling, or open-jaw logic.
 * UI changes must NOT touch search logic.
 */
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
import { useFlightStore } from "@/store/useFlightStore";

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
  airlineNames,
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
  totalDurationMinutes: number; // Max single leg duration (for filtering)
  combinedDurationMinutes?: number; // Combined out+in duration (for scoring)
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
    passengers: "Voksne",
    children: "Barn (0-11 år)",
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
    noFlightsFound: "Ingen flyreiser funnet som oppfyller kriteriene",
    noFlightsMainCriteria: "Ingen flyreiser innenfor hovedkriterier (max 22t, ingen nattfly 00:00-05:55)",
    onlyLongerFlights: "Det finnes kun flyreiser med lengre reisetid (over 25 timer)",
    tryExtendingSearch: "Prøv å utvide søket eller endre datoene",
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
    passengers: "Voksne",
    children: "Børn (0-11 år)",
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
    noFlightsFound: "Ingen flyrejser fundet som opfylder kriterierne",
    noFlightsMainCriteria: "Ingen flyrejser inden for hovedkriterier (max 22t, ingen natfly 00:00-05:55)",
    onlyLongerFlights: "Der findes kun flyrejser med længere rejsetid (over 25 timer)",
    tryExtendingSearch: "Prøv at udvide søgningen eller ændre datoerne",
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
    const outboundItinerary = offer.itineraries?.[0];
    const inboundItinerary = offer.itineraries?.[1];

    // Skip offers with missing data
    if (!outboundItinerary) {
      console.warn('⚠️ Skipping offer with missing outbound itinerary:', offer.id);
      return null as any; // Will be filtered out
    }

    const processItinerary = (itinerary: typeof outboundItinerary) => {
      if (!itinerary?.segments || itinerary.segments.length === 0) {
        return null;
      }

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
        duration: itinerary.duration || "PT0H0M",
        stops,
        airlines: airlines.map(code => airlineNames[code] || code),
        segments: segmentDetails,
      };
    };

    const outbound = processItinerary(outboundItinerary);
    const inbound = inboundItinerary ? processItinerary(inboundItinerary) : undefined;

    if (!outbound) {
      console.warn('⚠️ Skipping offer with invalid outbound data:', offer.id);
      return null as any;
    }

    const outDuration = getTotalMinutes(outbound.duration);
    const inDuration = inbound ? getTotalMinutes(inbound.duration) : 0;

    // Max duration of single leg for filtering (keep ≤22h or ≤25h check)
    const maxSingleLegDuration = Math.max(outDuration, inDuration);
    // Combined total duration for scoring (prioritize shortest total journey)
    const combinedDuration = outDuration + inDuration;

    return {
      id: offer.id,
      outbound,
      inbound,
      price: parseFloat(offer.price.grandTotal),
      currency: offer.price.currency,
      isRecommended: false,
      rawOffer: offer,
      totalDurationMinutes: maxSingleLegDuration, // Max single leg for filtering
      combinedDurationMinutes: combinedDuration, // Total out+in for scoring
      hasNightFlight: hasProblematicNightFlight(offer),
      searchDate: searchInfo?.date,
      nightsDiff: searchInfo?.nightsDiff,
    };
  }).filter(Boolean); // Remove null entries
}

/**
 * Calculate a quality score for flights (lower is better)
 * Prioritizes: 1) Combined total duration (out+in), 2) Connections, 3) Price
 */
function calculateFlightScore(flight: ProcessedFlight): number {
  // Use COMBINED duration (outbound + inbound) to prioritize shortest total journey
  const durationScore = flight.combinedDurationMinutes || flight.totalDurationMinutes; // Raw minutes
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
  console.log(`🔍 CATEGORIZE: Received ${flights.length} total flights`);
  
  // HARD FILTER: Never show flights over 25 hours
  const validFlights = flights.filter(f =>
    f.totalDurationMinutes <= MAX_EXTENDED_DURATION_HOURS * 60
  );

  console.log(`✅ Valid flights (≤25h): ${validFlights.length}`);
  
  if (validFlights.length === 0) {
    console.warn('⚠️ NO flights under 25 hours - showing nothing');
    return { bestAndCheapest: null, bestQuality: null, cheapestExtended: null };
  }

  // Category 1 & 2: Strict flights (≤22h, no night flights)
  const strictFlights = validFlights.filter(f =>
    f.totalDurationMinutes <= MAX_STRICT_DURATION_HOURS * 60 && !f.hasNightFlight
  );

  console.log(`✅ Strict flights (≤22h, no night): ${strictFlights.length}`);
  console.log(`🌙 Flights with night departures/arrivals: ${validFlights.filter(f => f.hasNightFlight).length}`);
  console.log(`⏱️ Flights over 22h (but under 25h): ${validFlights.filter(f => f.totalDurationMinutes > MAX_STRICT_DURATION_HOURS * 60).length}`);

  // Score strict flights with special handling for similar prices
  const scoredStrict = strictFlights
    .map(f => ({ ...f, score: calculateFlightScore(f) }))
    .sort((a, b) => {
      // If prices are within 300 kr, prioritize by combined duration
      if (Math.abs(a.price - b.price) <= 300) {
        const aDuration = a.combinedDurationMinutes || a.totalDurationMinutes;
        const bDuration = b.combinedDurationMinutes || b.totalDurationMinutes;
        return aDuration - bDuration;
      }
      // Otherwise use normal score (duration + stops + price)
      return a.score - b.score;
    });

  // RESULT 1: Best and cheapest (combines best score with lowest price among strict)
  const bestAndCheapest = scoredStrict[0] ? { ...scoredStrict[0], isRecommended: true } : null;

  // RESULT 2: Best overall by quality alone (different from Result 1, or second-best if only one)
  let bestQuality: ProcessedFlight | null = null;
  if (strictFlights.length > 1) {
    // Find first flight with different ID
    bestQuality = scoredStrict.find(f => f.id !== bestAndCheapest?.id) || null;
  }

  // RESULT 3: Cheapest extended (≤25h, allows night flights) - prioritize duration when prices similar
  const sortedByPrice = [...validFlights].sort((a, b) => {
    // If prices are within 300 kr, prioritize by combined duration
    if (Math.abs(a.price - b.price) <= 300) {
      const aDuration = a.combinedDurationMinutes || a.totalDurationMinutes;
      const bDuration = b.combinedDurationMinutes || b.totalDurationMinutes;
      return aDuration - bDuration;
    }
    return a.price - b.price;
  });
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
  const [departureDateInput, setDepartureDateInput] = useState("");
  const [returnDateInput, setReturnDateInput] = useState("");
  const [passengers, setPassengers] = useState("1");
  const [children, setChildren] = useState("0");
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

  // Parse DDMM format (e.g., "0510" → Date object for 05.10.2026)
  const parseDDMM = (input: string): Date | null => {
    // Remove any non-digits
    const digits = input.replace(/\D/g, '');
    if (digits.length !== 4) return null;
    
    const day = parseInt(digits.substring(0, 2));
    const month = parseInt(digits.substring(2, 4));
    
    // Validate
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    
    // Use current year or next year if month has passed
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // If the month has already passed this year, use next year
    let year = currentYear;
    if (month < currentMonth || (month === currentMonth && day < now.getDate())) {
      year = currentYear + 1;
    }
    
    const date = new Date(year, month - 1, day);
    
    // Validate the date is valid
    if (date.getDate() !== day || date.getMonth() !== month - 1) {
      return null;
    }
    
    return date;
  };

  const departureDateStr = formatDateForApi(departureDate);
  const returnDateStr = formatDateForApi(returnDate);

  // Use date-fns locale for formatting, and DayPicker locale for Calendar
  const dateFnsLocale = language === "da" ? daFns : nbFns;
  const dayPickerLocale: Partial<DayPickerLocale> = language === "da" ? daPicker : nbPicker;

  // Flexible options
  const [flexibleDates, setFlexibleDates] = useState(false);
  const [flexibleNights, setFlexibleNights] = useState(1);
  const [addNights, setAddNights] = useState(false);
  const [addNightsCount, setAddNightsCount] = useState(1);
  const [removeNights, setRemoveNights] = useState(false);
  const [removeNightsCount, setRemoveNightsCount] = useState(1);

  // NEW: Children checkbox state
  const [includeChildren, setIncludeChildren] = useState(false);

  // Date interval option
  const [useDateInterval, setUseDateInterval] = useState(false);
  const [earliestDeparture, setEarliestDeparture] = useState<Date | undefined>(undefined);
  const [latestDeparture, setLatestDeparture] = useState<Date | undefined>(undefined);
  const [earliestDateOpen, setEarliestDateOpen] = useState(false);
  const [latestDateOpen, setLatestDateOpen] = useState(false);

  // Results - nå fra Zustand store med auto-persist
  const { savedFlights, addFlight, clearFlights } = useFlightInfo();
  const {
    mainResults,
    bestQualityResult,
    cheapestExtendedResult,
    flexibleResult,
    extendedStayResult,
    dateIntervalResult,
    setMainResults,
    setBestQualityResult,
    setCheapestExtendedResult,
    setFlexibleResult,
    setExtendedStayResult,
    setDateIntervalResult,
    setHasSearched,
    resetAll: resetFlightStore,
  } = useFlightStore();
  const hasSearched = useFlightStore(state => state.hasSearched);

  // Hjelpefunksjon for å konvertere ProcessedFlight til FlightInfo
  function toFlightInfo(flight: ProcessedFlight, title: string): FlightInfo {
    return {
      id: flight.id,
      title,
      price: flight.price,
      currency: flight.currency,
      outbound: {
        departure: flight.outbound.departure,
        arrival: flight.outbound.arrival,
        departureTime: flight.outbound.departureTime,
        arrivalTime: flight.outbound.arrivalTime,
        duration: flight.outbound.duration,
        stops: flight.outbound.stops,
      },
      inbound: flight.inbound
        ? {
            departure: flight.inbound.departure,
            arrival: flight.inbound.arrival,
            departureTime: flight.inbound.departureTime,
            arrivalTime: flight.inbound.arrivalTime,
            duration: flight.inbound.duration,
            stops: flight.inbound.stops,
          }
        : undefined,
      passengers: parseInt(passengers),
    };
  }

  // Nullstill-knapp
  function handleReset() {
    clearFlights();
    resetFlightStore();
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
      // Extract segments from rawOffer
      const segments: any[] = [];
      
      if (flight.rawOffer?.itineraries?.[0]?.segments) {
        flight.rawOffer.itineraries[0].segments.forEach((seg: any) => {
          const depDate = new Date(seg.departure.at);
          const arrDate = new Date(seg.arrival.at);
          segments.push({
            date: format(depDate, 'dd.MM.yyyy'),
            from: seg.departure.iataCode,
            to: seg.arrival.iataCode,
            time: `${formatTime(seg.departure.at)}–${formatTime(seg.arrival.at)}`,
            airline: seg.carrierCode || seg.operating?.carrierCode || 'N/A'
          });
        });
      }
      
      if (flight.rawOffer?.itineraries?.[1]?.segments) {
        flight.rawOffer.itineraries[1].segments.forEach((seg: any) => {
          const depDate = new Date(seg.departure.at);
          const arrDate = new Date(seg.arrival.at);
          segments.push({
            date: format(depDate, 'dd.MM.yyyy'),
            from: seg.departure.iataCode,
            to: seg.arrival.iataCode,
            time: `${formatTime(seg.departure.at)}–${formatTime(seg.arrival.at)}`,
            airline: seg.carrierCode || seg.operating?.carrierCode || 'N/A'
          });
        });
      }

      const flightData: any = {
        period: departureDateStr && returnDateStr ? `${format(new Date(departureDateStr), "dd.MM.yyyy")} - ${format(new Date(returnDateStr), "dd.MM.yyyy")}` : '',
        passengers: passengers,
        flights: []
      };
      flightData.flights.push({
        title,
        price: `${flight.price} ${flight.currency}`,
        segments
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
    const isOpenJaw = retFrom !== dest || retTo !== dep;
    
    const response = await searchFlights({
      originLocationCode: dep,
      destinationLocationCode: dest,
      departureDate: depDate,
      returnDate: retDate,
      returnOriginCode: isOpenJaw ? retFrom : undefined,
      returnDestinationCode: isOpenJaw ? retTo : undefined,
      adults: pax,
      currencyCode: currency,
      max: 50,
      language, // Send språk til Farewise API
    });
    
    // Håndter både Amadeus {data: [...]} og Farewise [...] format
    if (Array.isArray(response)) {
      return response; // Farewise format
    } else if (response && Array.isArray((response as any).data)) {
      return (response as any).data; // Amadeus format
    }
    return [];
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
      console.log('🔍 SEARCH START:', { departure, destination, returnFrom, returnTo, departureDateStr, returnDateStr, pax, currency });
      const mainOffers = await searchFlightsApi(departure, destination, returnFrom, returnTo, departureDateStr, returnDateStr, pax, currency);
      console.log('📡 API RESPONSE:', mainOffers.length, 'offers received');
      const processedFlights = processFlightOffers(mainOffers);
      console.log('⚙️ PROCESSED:', processedFlights.length, 'flights after processing');
      const categories = categorizeFlights(processedFlights, t);

      // Set all 3 mandatory categories
      setMainResults({ bestAndCheapest: categories.bestAndCheapest, cheapest: null });
      setBestQualityResult(categories.bestQuality);
      setCheapestExtendedResult(categories.cheapestExtended);
      if (categories.bestAndCheapest) addFlight(toFlightInfo(categories.bestAndCheapest, t.bestAndCheapest));
      if (categories.bestQuality) addFlight(toFlightInfo(categories.bestQuality, t.beste));
      if (categories.cheapestExtended) addFlight(toFlightInfo(categories.cheapestExtended, t.cheapest));
      if (flexibleResult) addFlight(toFlightInfo(flexibleResult, t.cheaperFlexible));
      if (extendedStayResult) addFlight(toFlightInfo(extendedStayResult, t.cheaperExtended));
      if (dateIntervalResult) addFlight(toFlightInfo(dateIntervalResult, t.searchInInterval));

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

            {/* FRA (AVREISE) */}
            <div className="space-y-1">
              <Label>{t.from}</Label>
              <Input
                value={departure}
                onChange={(e) =>
                  setDeparture(e.target.value.toUpperCase().slice(0, 3))
                }
                placeholder={t.iataPlaceholder}
                className="uppercase bg-muted/30"
                maxLength={3}
              />
            </div>

            {/* TIL (DESTINASJON) */}
            <div className="space-y-1">
              <Label>{t.to}</Label>
              <Input
                value={destination}
                onChange={(e) =>
                  setDestination(e.target.value.toUpperCase().slice(0, 3))
                }
                placeholder={t.iataPlaceholder}
                className="uppercase bg-muted/30"
                maxLength={3}
              />
            </div>

            {/* Adults */}
            <div className="space-y-1">
              <Label>{t.passengers}</Label>
              <Select value={passengers} onValueChange={setPassengers}>
                <SelectTrigger className="bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">

            {/* RETUR FRA */}
            <div className="space-y-1">
              <Label>{t.returnFrom}</Label>
              <Input
                value={returnFrom}
                onChange={(e) =>
                  setReturnFrom(e.target.value.toUpperCase().slice(0, 3))
                }
                placeholder={t.iataPlaceholder}
                className="uppercase bg-muted/30"
                maxLength={3}
              />
            </div>

            {/* Return To - Free IATA input */}
            <div className="space-y-1">
              <Label>{t.returnTo}</Label>
              <Input
                value={returnTo}
                onChange={(e) => setReturnTo(e.target.value.toUpperCase().slice(0, 3))}
                placeholder={t.iataPlaceholder}
                className="uppercase bg-muted/30"
                maxLength={3}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">

            {/* Departure Date */}
            <div className="space-y-1">
              <Label htmlFor="departure-date">{t.departDate}</Label>
              <div className="flex gap-2">
                <Input
                  id="departure-date"
                  placeholder="DDMM (f.eks. 0510)"
                  value={departureDateInput}
                  onChange={(e) => setDepartureDateInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const parsed = parseDDMM(departureDateInput);
                      if (parsed) {
                        setDepartureDate(parsed);
                        setDepartureDateInput(format(parsed, 'dd.MM.yyyy'));
                      }
                    }
                  }}
                  onBlur={() => {
                    const parsed = parseDDMM(departureDateInput);
                    if (parsed) {
                      setDepartureDate(parsed);
                      setDepartureDateInput(format(parsed, 'dd.MM.yyyy'));
                    } else if (departureDate) {
                      setDepartureDateInput(format(departureDate, 'dd.MM.yyyy'));
                    }
                  }}
                  className="bg-muted/30 flex-1"
                />
                <Popover open={departureDateOpen} onOpenChange={setDepartureDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="bg-muted/30">
                      <CalendarIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={departureDate}
                      onSelect={(date) => {
                        setDepartureDate(date);
                        setDepartureDateInput(date ? format(date, 'dd.MM.yyyy') : '');
                        setDepartureDateOpen(false);
                      }}
                      disabled={(date) => date < today || date > maxDate}
                      initialFocus
                      locale={dayPickerLocale}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Return Date */}
            <div className="space-y-1">
              <Label htmlFor="return-date">{t.returnDate}</Label>
              <div className="flex gap-2">
                <Input
                  id="return-date"
                  placeholder="DDMM (f.eks. 1510)"
                  value={returnDateInput}
                  onChange={(e) => setReturnDateInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const parsed = parseDDMM(returnDateInput);
                      if (parsed) {
                        setReturnDate(parsed);
                        setReturnDateInput(format(parsed, 'dd.MM.yyyy'));
                      }
                    }
                  }}
                  onBlur={() => {
                    const parsed = parseDDMM(returnDateInput);
                    if (parsed) {
                      setReturnDate(parsed);
                      setReturnDateInput(format(parsed, 'dd.MM.yyyy'));
                    } else if (returnDate) {
                      setReturnDateInput(format(returnDate, 'dd.MM.yyyy'));
                    }
                  }}
                  className="bg-muted/30 flex-1"
                />
                <Popover open={returnDateOpen} onOpenChange={setReturnDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="bg-muted/30">
                      <CalendarIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={returnDate}
                      onSelect={(date) => {
                        setReturnDate(date);
                        setReturnDateInput(date ? format(date, 'dd.MM.yyyy') : '');
                        setReturnDateOpen(false);
                      }}
                      disabled={(date) => {
                        const minDate = departureDate || today;
                        return date < minDate || date > maxDate;
                      }}
                      initialFocus
                      locale={dayPickerLocale}
                    />
                  </PopoverContent>
                </Popover>
              </div>
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
                  <SelectTrigger className="w-16 h-8 bg-muted/30">
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
                  <SelectTrigger className="w-16 h-8 bg-muted/30">
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
                  <SelectTrigger className="w-16 h-8 bg-muted/30">
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

            {/* NEW: Children Option */}
            <div className="flex items-center gap-3">
              <Checkbox
                id="includeChildren"
                checked={includeChildren}
                onCheckedChange={(checked) => setIncludeChildren(checked === true)}
              />
              <Label htmlFor="includeChildren" className="flex items-center gap-2 cursor-pointer">
                {t.children}
                <Select value={children} onValueChange={setChildren}>
                  <SelectTrigger className="w-16 h-8 bg-muted/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <div className="flex flex-wrap items-center gap-2">
                {/* Earliest departure - NEW: auto-set to departure month when opened */}
                <Input
                  type="date"
                  value={earliestDeparture ? format(earliestDeparture, "yyyy-MM-dd") : ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEarliestDeparture(value ? new Date(value) : undefined);
                  }}
                  onFocus={(e) => {
                    // NEW: Auto-set month to departure date's month when first opened
                    if (!earliestDeparture && departureDate) {
                      e.target.value = format(departureDate, "yyyy-MM-dd");
                      setEarliestDeparture(departureDate);
                    }
                  }}
                  min={format(new Date(), "yyyy-MM-dd")}
                  className="w-[150px]"
                  disabled={!useDateInterval}
                />

                <span className="text-muted-foreground">→</span>

                {/* Latest departure - NEW: auto-set to return month when opened */}
                <Input
                  type="date"
                  value={latestDeparture ? format(latestDeparture, "yyyy-MM-dd") : ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setLatestDeparture(value ? new Date(value) : undefined);
                  }}
                  onFocus={(e) => {
                    // NEW: Auto-set month to return date's month when first opened
                    if (!latestDeparture && returnDate) {
                      e.target.value = format(returnDate, "yyyy-MM-dd");
                      setLatestDeparture(returnDate);
                    }
                  }}
                  min={
                    earliestDeparture
                      ? format(earliestDeparture, "yyyy-MM-dd")
                      : format(new Date(), "yyyy-MM-dd")
                  }
                  className="w-[150px]"
                  disabled={!useDateInterval}
                />
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

              {/* Nullstill-knapp */}
              {(mainResults.bestAndCheapest || bestQualityResult || cheapestExtendedResult || flexibleResult || extendedStayResult || dateIntervalResult) && (
                <Button
                  onClick={handleReset}
                  variant="destructive"
                  className="w-full"
                  size="lg"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {language === "no" ? "Nullstill alle resultater" : "Nulstil alle resultater"}
                </Button>
              )}
            </div>
          </div> {/* slutten på Flexible Options */}
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
              <div className="relative">
                <FlightResultCard
                  flight={mainResults.bestAndCheapest}
                  language={language}
                  translations={t}
                  formatTime={formatTime}
                  formatDate={formatDate}
                  formatDuration={formatDuration}
                  onSave={saveToPowerPointSingle}
                  title={t.bestAndCheapest}
                  childrenCount={includeChildren ? parseInt(children) : 0}
                  hasNightFlight={mainResults.bestAndCheapest.hasNightFlight}
                />
              </div>
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
                onSave={saveToPowerPointSingle}
                title={t.beste}
                childrenCount={includeChildren ? parseInt(children) : 0}
                hasNightFlight={bestQualityResult.hasNightFlight}
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
                onSave={saveToPowerPointSingle}
                title={t.cheapest}
                childrenCount={includeChildren ? parseInt(children) : 0}
                hasNightFlight={cheapestExtendedResult.hasNightFlight}
              />
            </div>
          )}
        </div>
      )}

      {/* FLEXIBLE DATE RESULT */}
      {flexibleResult && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold text-foreground">{t.cheaperFlexible}</h3>
              {flexibleResult.searchDate && (
                <p className="text-xs text-muted-foreground">
                  Avreise: {format(new Date(flexibleResult.searchDate), "dd.MM.yyyy")}
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
            onSave={saveToPowerPointSingle}
            title={t.cheaperFlexible}
            childrenCount={includeChildren ? parseInt(children) : 0}
            hasNightFlight={flexibleResult.hasNightFlight}
          />
        </div>
      )}

      {/* EXTENDED STAY RESULT */}
      {extendedStayResult && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold text-foreground">
                {t.cheaperExtended} {Math.abs(extendedStayResult.nightsDiff || 0)} {(extendedStayResult.nightsDiff || 0) > 0 ? t.extraNights : t.fewerNights}
              </h3>
              <p className="text-xs text-muted-foreground">
                {(extendedStayResult.nightsDiff || 0) > 0 ? "Lengre opphold" : "Kortere opphold"}
              </p>
            </div>
          </div>
          <FlightResultCard
            flight={extendedStayResult}
            language={language}
            translations={t}
            formatTime={formatTime}
            formatDate={formatDate}
            formatDuration={formatDuration}
            onSave={saveToPowerPointSingle}
            title={t.cheaperExtended}
            childrenCount={includeChildren ? parseInt(children) : 0}
            hasNightFlight={extendedStayResult.hasNightFlight}
          />
        </div>
      )}

      {/* DATE INTERVAL RESULT */}
      {dateIntervalResult && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold text-foreground">{t.searchInInterval}</h3>
              {dateIntervalResult.searchDate && (
                <p className="text-xs text-muted-foreground">
                  Avreise: {format(new Date(dateIntervalResult.searchDate), "dd.MM.yyyy")}
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
            onSave={saveToPowerPointSingle}
            title={t.searchInInterval}
            childrenCount={includeChildren ? parseInt(children) : 0}
            hasNightFlight={dateIntervalResult.hasNightFlight}
          />
        </div>
      )}

      {hasSearched && !mainResults.bestAndCheapest && !bestQualityResult && !cheapestExtendedResult && !isSearching && !error && (
        <Card className="border-border/50 bg-muted/20">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground text-lg">{t.noFlightsFound}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t.noFlightsMainCriteria}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t.onlyLongerFlights}
                  </p>
                  <p className="text-sm font-medium text-foreground mt-3">
                    💡 {t.tryExtendingSearch}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
