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
  Info,
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
    airlines: string[]; // IATA codes for matching
    airlineNames?: string[]; // Full names for display (optional for backward compatibility)
    segments: string;
  };
  inbound?: {
    departure: string;
    arrival: string;
    departureTime: string;
    arrivalTime: string;
    duration: string;
    stops: number;
    airlines: string[]; // IATA codes for matching
    airlineNames?: string[]; // Full names for display (optional for backward compatibility)
    segments: string;
  };
  price: number;
  currency: string;
  fareType?: "NEGOTIATED" | "PUBLIC";
  isRecommended: boolean;
  recommendReason?: string;
  rawOffer?: FlightOffer;
  totalDurationMinutes: number; // Max single leg duration (for filtering)
  combinedDurationMinutes?: number; // Combined out+in duration (for scoring)
  hasNightFlight: boolean;
  hasInvalidOsloLayover?: boolean; // Oslo layover < 2 hours (NO only)
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

// Helper function to get max strict duration based on departure airport
function getMaxStrictDurationHours(departureAirport: string): number {
  const MAJOR_HUBS = ['OSL', 'HAM', 'CPH']; // Major European hubs with better connections
  return MAJOR_HUBS.includes(departureAirport.toUpperCase()) ? 20 : 22;
}

const MAX_EXTENDED_DURATION_HOURS = 25;  // Extended alternatives: max 25 hours
const NIGHT_START_MINUTES = 30;          // Night period starts 00:30 (30 minutes)
const NIGHT_END_MINUTES = 350;           // Night period ends 05:50 (5*60 + 50 = 350 minutes)

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
    cheapestWithFlexibility: "Billigste (opptil 25 timer, ingen nattfly)",
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
    flexibleDates: "Fleksible datoer ±",
    nights: "",
    addNights: "Legg til netter +",
    removeNights: "Fjern netter -",
    nightsExtra: "",
    nightsLess: "",
    mainResults: "Hovedresultater",
    mainResultsDesc: "Max 22t reisetid, ingen nattfly (00:30-05:50)",
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
    dateIntervalInfo: "Dette søket går over en lengre periode og vil derfor ta noe lengre tid siden det søkes på mange datoer.",
    earliestDeparture: "Tidligste avreise",
    latestDeparture: "Seneste avreise",
    searchInInterval: "Søk billigste i periode",
    iataPlaceholder: "IATA (f.eks. OSL)",
    showDetails: "Vis detaljer",
    hideDetails: "Skjul detaljer",
    noFlightsFound: "Ingen flyreiser funnet som oppfyller kriteriene",
    noFlightsMainCriteria: "Ingen flyreiser innenfor hovedkriterier (max 22t, ingen nattfly 00:30-05:50)",
    onlyLongerFlights: "Det finnes kun flyreiser med lengre reisetid (over 25 timer)",
    tryExtendingSearch: "Prøv å utvide søket eller endre datoene",
    preferredAirline: "Velg flyselskap",
    selectAirline: "Velg flyselskap",
    noPreferredAirlineResults: "Ingen resultater funnet med valgt flyselskap som passer til kriteriene",
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
    cheapestWithFlexibility: "Billigste (op til 25 timer, ingen natfly)",
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
    flexibleDates: "Fleksible datoer ±",
    nights: "",
    addNights: "Tilføj nætter +",
    removeNights: "Fjern nætter -",
    nightsExtra: "",
    nightsLess: "",
    mainResults: "Hovedresultater",
    mainResultsDesc: "Max 22t rejsetid, ingen natfly (00:30-05:50)",
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
    dateIntervalInfo: "Denne søgning dækker en længere periode og vil derfor tage lidt længere tid, da der søges på mange datoer.",
    earliestDeparture: "Tidligste afrejse",
    latestDeparture: "Seneste afrejse",
    searchInInterval: "Søg billigste i periode",
    iataPlaceholder: "IATA (f.eks. CPH)",
    showDetails: "Vis detaljer",
    hideDetails: "Skjul detaljer",
    noFlightsFound: "Ingen flyrejser fundet som opfylder kriterierne",
    noFlightsMainCriteria: "Ingen flyrejser inden for hovedkriterier (max 22t, ingen natfly 00:30-05:50)",
    onlyLongerFlights: "Der findes kun flyrejser med længere rejsetid (over 25 timer)",
    tryExtendingSearch: "Prøv at udvide søgningen eller ændre datoerne",
    preferredAirline: "Vælg flyselskab",
    selectAirline: "Vælg flyselskab",
    noPreferredAirlineResults: "Ingen resultater fundet med valgt flyselskab som passer til kriterierne",
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
  // Parse ISO string and extract time components directly to show airport local time
  // Example: "2026-02-17T19:45:00+03:00" (Dar es Salaam) should show 19:45, not converted
  const date = new Date(isoDateTime);
  
  // Extract timezone offset from ISO string if present
  const tzMatch = isoDateTime.match(/([+-]\d{2}:\d{2}|Z)$/);
  
  if (tzMatch) {
    // ISO string has timezone info - use UTC and format to show the original time
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    
    // Parse timezone offset
    let offsetMinutes = 0;
    if (tzMatch[1] !== 'Z') {
      const [offsetHours, offsetMins] = tzMatch[1].split(':').map(s => parseInt(s.replace('+', '')));
      offsetMinutes = offsetHours * 60 + (offsetHours < 0 ? -offsetMins : offsetMins);
    }
    
    // Apply offset to get local airport time
    const totalMinutes = hours * 60 + minutes + offsetMinutes;
    const localHours = Math.floor(totalMinutes / 60) % 24;
    const localMinutes = totalMinutes % 60;
    
    return `${String(localHours).padStart(2, '0')}:${String(localMinutes).padStart(2, '0')}`;
  }
  
  // Fallback: no timezone in string, use as-is
  return date.toLocaleTimeString("no-NO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC", // Interpret as UTC to avoid double conversion
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
 * Check if a time falls in the night period (00:30 - 05:50)
 * Parse time directly from ISO string to avoid timezone conversion issues
 */
function isNightTime(dateTimeStr: string): boolean {
  // Parse time directly from ISO string: "2026-05-06T04:05:00+00:00"
  const timeMatch = dateTimeStr.match(/T(\d{2}):(\d{2})/);
  if (!timeMatch) {
    console.warn(`❌ Could not parse time from: ${dateTimeStr}`);
    return false;
  }
  
  const hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2]);
  const timeInMinutes = hours * 60 + minutes;
  const isNight = timeInMinutes >= NIGHT_START_MINUTES && timeInMinutes < NIGHT_END_MINUTES;
  
  // Debug logging to track what's happening
  console.log(`🕐 TIME CHECK: ${dateTimeStr} → ${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')} → ${timeInMinutes} minutes → ${isNight ? 'NIGHT (BLOCKED)' : 'DAY (OK)'}`);
  
  return isNight;
}

/**
 * Check if flight has problematic night arrival/departure at CRITICAL ENDPOINTS ONLY:
 * BLOCKED: Arrival at final destination (JRO/ZNZ/DAR) between 00:30-05:50
 * BLOCKED: Departure from origin on return leg (JRO/ZNZ/DAR) between 00:30-05:50
 * OK: Night layovers in between are allowed (ADD, DOH, AMS, etc)
 */
function hasProblematicNightFlight(offer: FlightOffer): boolean {
  // Check OUTBOUND: arrival at final destination in Africa
  const outboundItinerary = offer.itineraries[0];
  const lastOutboundSegment = outboundItinerary.segments[outboundItinerary.segments.length - 1];
  const outboundArrivalTime = lastOutboundSegment.arrival.at;
  
  // Debug: Log flight details for Turkish Airlines
  const carrierCodes = outboundItinerary.segments.map(seg => seg.carrierCode);
  const hasTurkish = carrierCodes.includes('TK');
  if (hasTurkish) {
    console.log(`🛫 TURKISH FLIGHT CHECK - Carriers: ${carrierCodes.join(', ')}, Arrival: ${outboundArrivalTime}, Destination: ${lastOutboundSegment.arrival.iataCode}`);
  }

  if (isNightTime(outboundArrivalTime)) {
    if (hasTurkish) {
      console.log(`❌ BLOCKING Turkish flight - arrives at night: ${outboundArrivalTime}`);
    }
    return true; // BLOCKED: arrives at destination during night
  }

  // Check RETURN: departure from origin in Africa
  if (offer.itineraries.length > 1) {
    const returnItinerary = offer.itineraries[1];
    const firstReturnSegment = returnItinerary.segments[0];
    const returnDepartureTime = firstReturnSegment.departure.at;
    
    // Debug: Log return flight details for Turkish Airlines
    const returnCarrierCodes = returnItinerary.segments.map(seg => seg.carrierCode);
    const hasReturnTurkish = returnCarrierCodes.includes('TK');
    if (hasReturnTurkish) {
      console.log(`🛬 TURKISH RETURN CHECK - Carriers: ${returnCarrierCodes.join(', ')}, Departure: ${returnDepartureTime}, Origin: ${firstReturnSegment.departure.iataCode}`);
    }

    if (isNightTime(returnDepartureTime)) {
      if (hasReturnTurkish) {
        console.log(`❌ BLOCKING Turkish return flight - departs at night: ${returnDepartureTime}`);
      }
      return true; // BLOCKED: departs from return origin during night
    }
  }

  return false; // OK: no problematic night flights at critical endpoints
}

/**
 * Check if flight has Oslo layover with less than 2 hours connection time
 * Only applies to Norwegian flights (NO language)
 */
function hasInvalidOsloLayover(offer: FlightOffer): boolean {
  // Check all itineraries (outbound and return)
  for (const itinerary of offer.itineraries) {
    const segments = itinerary.segments;
    
    // Check each connection point
    for (let i = 0; i < segments.length - 1; i++) {
      const currentSeg = segments[i];
      const nextSeg = segments[i + 1];
      
      // Check if this is an Oslo connection (arrival and departure both OSL)
      if (currentSeg.arrival.iataCode === 'OSL' && nextSeg.departure.iataCode === 'OSL') {
        // Calculate layover time
        const arrivalTime = new Date(currentSeg.arrival.at);
        const departureTime = new Date(nextSeg.departure.at);
        const layoverMinutes = (departureTime.getTime() - arrivalTime.getTime()) / (1000 * 60);
        
        // Minimum 2 hours (120 minutes) required for Oslo
        if (layoverMinutes < 120) {
          console.log(`⚠️ Invalid Oslo layover: ${Math.round(layoverMinutes)} min (min 120 min required)`);
          return true; // BLOCKED: Oslo layover too short
        }
      }
    }
  }
  
  return false; // OK: No Oslo layovers or all Oslo layovers are ≥2 hours
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
  searchInfo?: { date: string; nightsDiff: number },
  passengerCount: number = 1
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

      // Debug logging for EK flights
      if (airlines.includes('EK')) {
        console.log('🔍 Found EK in segment carriers:', {
          route: `${firstSeg.departure.iataCode} → ${lastSeg.arrival.iataCode}`,
          carriers: airlines,
          segments: itinerary.segments.map(s => `${s.departure.iataCode}-${s.arrival.iataCode}: ${s.carrierCode}`)
        });
      }

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
        airlines: airlines, // Keep IATA codes (ET, QR, etc.) for matching
        airlineNames: airlines.map(code => airlineNames[code] || code), // Full names for display only
        segments: segmentDetails,
      };
    };

    const outbound = processItinerary(outboundItinerary);
    const inbound = inboundItinerary ? processItinerary(inboundItinerary) : undefined;

    if (!outbound) {
      console.warn('⚠️ Skipping offer with invalid outbound data:', offer.id);
      return null as any;
    }

    // Debug EK flights - check duration format
    const hasEK = outbound.airlines.includes('EK') || (inbound?.airlines.includes('EK') ?? false);
    if (hasEK) {
      console.log('🔍 EK DURATION in processFlightOffer:', {
        id: offer.id,
        'outbound.duration': outbound.duration,
        'inbound.duration': inbound?.duration,
        'offer.fareType': offer.fareType,
        'offer.price': offer.price,
      });
    }

    const outDuration = getTotalMinutes(outbound.duration);
    const inDuration = inbound ? getTotalMinutes(inbound.duration) : 0;

    if (hasEK) {
      console.log('🔍 EK PARSED DURATION:', {
        id: offer.id,
        outDuration: outDuration + ' minutes (' + Math.round(outDuration / 60) + 'h)',
        inDuration: inDuration + ' minutes (' + Math.round(inDuration / 60) + 'h)',
      });
    }

    // Max duration of single leg for filtering (keep ≤22h or ≤25h check)
    const maxSingleLegDuration = Math.max(outDuration, inDuration);
    // Combined total duration for scoring (prioritize shortest total journey)
    const combinedDuration = outDuration + inDuration;

    if (hasEK && offer.fareType !== 'NEGOTIATED') {
      console.log('⚠️ EK FARE TYPE NOT NEGOTIATED:', {
        id: offer.id,
        fareType: offer.fareType,
        'offer.price keys': Object.keys(offer.price || {}),
        'offer keys (first 20)': Object.keys(offer).slice(0, 20),
      });
    }

    return {
      id: offer.id,
      outbound,
      inbound,
      price: parseFloat(offer.price.grandTotal) / passengerCount,
      currency: offer.price.currency,
      fareType: offer.fareType,
      isRecommended: false,
      rawOffer: offer,
      totalDurationMinutes: maxSingleLegDuration, // Max single leg for filtering
      combinedDurationMinutes: combinedDuration, // Total out+in for scoring
      hasNightFlight: hasProblematicNightFlight(offer),
      hasInvalidOsloLayover: hasInvalidOsloLayover(offer),
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
 * 3. Cheapest (≤25h, NO night flights - longer time allowed but still no night departures/arrivals)
 */
function categorizeFlights(
  flights: ProcessedFlight[], 
  t: typeof translations.no,
  departureAirport: string,
  language: 'no' | 'da'
): {
  bestAndCheapest: ProcessedFlight | null;
  bestQuality: ProcessedFlight | null;
  cheapestExtended: ProcessedFlight | null;
} {
  const MAX_STRICT_DURATION_HOURS = getMaxStrictDurationHours(departureAirport);
  console.log(`🔍 CATEGORIZE: Received ${flights.length} total flights (max strict: ${MAX_STRICT_DURATION_HOURS}h for ${departureAirport})`);
  
  // HARD FILTER: Never show flights over 25 hours
  let validFlights = flights.filter(f =>
    f.totalDurationMinutes <= MAX_EXTENDED_DURATION_HOURS * 60
  );

  // HARD FILTER (NO only): Oslo layover must be ≥ 2 hours
  if (language === 'no') {
    const beforeOsloFilter = validFlights.length;
    validFlights = validFlights.filter(f => f.hasInvalidOsloLayover !== true);
    const removedOslo = beforeOsloFilter - validFlights.length;
    if (removedOslo > 0) {
      console.log(`🇳🇴 Removed ${removedOslo} flights with Oslo layover < 2 hours`);
    }
  }

  console.log(`✅ Valid flights (≤25h): ${validFlights.length}`);
  
  if (validFlights.length === 0) {
    console.warn('⚠️ NO flights under 25 hours - showing nothing');
    return { bestAndCheapest: null, bestQuality: null, cheapestExtended: null };
  }

  // Category 1 & 2: Strict flights (≤20h or ≤22h depending on departure, no night flights)
  const strictFlights = validFlights.filter(f =>
    f.totalDurationMinutes <= MAX_STRICT_DURATION_HOURS * 60 && !f.hasNightFlight
  );

  console.log(`✅ Strict flights (≤${MAX_STRICT_DURATION_HOURS}h, no night): ${strictFlights.length}`);
  console.log(`🌙 Flights with night departures/arrivals: ${validFlights.filter(f => f.hasNightFlight).length}`);
  console.log(`⏱️ Flights over ${MAX_STRICT_DURATION_HOURS}h (but under 25h): ${validFlights.filter(f => f.totalDurationMinutes > MAX_STRICT_DURATION_HOURS * 60).length}`);

  // Score strict flights with special handling for similar prices and fare types
  const PACKAGE_FARE_TOLERANCE = 300; // Prefer NEGOTIATED if within 300 kr
  
  const scoredStrict = strictFlights
    .map(f => ({ ...f, score: calculateFlightScore(f) }))
    .sort((a, b) => {
      // PRIORITY 1: Prefer NEGOTIATED (package) fares when comparable price
      const isANegotiated = a.fareType === 'NEGOTIATED';
      const isBNegotiated = b.fareType === 'NEGOTIATED';
      
      if (isANegotiated && !isBNegotiated) {
        // A is package, B is public: choose A if within tolerance
        if (a.price <= b.price + PACKAGE_FARE_TOLERANCE) return -1;
      }
      if (!isANegotiated && isBNegotiated) {
        // B is package, A is public: choose B if within tolerance
        if (b.price <= a.price + PACKAGE_FARE_TOLERANCE) return 1;
      }
      
      // PRIORITY 2: If prices are within 300 kr, prioritize by combined duration
      if (Math.abs(a.price - b.price) <= 300) {
        const aDuration = a.combinedDurationMinutes || a.totalDurationMinutes;
        const bDuration = b.combinedDurationMinutes || b.totalDurationMinutes;
        return aDuration - bDuration;
      }
      // PRIORITY 3: Otherwise use normal score (duration + stops + price)
      return a.score - b.score;
    });

  // RESULT 1: Best and cheapest (combines best score with lowest price among strict)
  // This is the BASE PRICE - all other categories must be same price or more expensive!
  const bestAndCheapest = scoredStrict[0] ? { ...scoredStrict[0], isRecommended: true } : null;
  const basePrice = bestAndCheapest?.price || 0;

  // RESULT 2: Best by QUALITY ONLY (shortest duration + fewest stops)
  // MUST be same price or MORE EXPENSIVE than bestAndCheapest!
  const packageTolerance = language === 'da' ? 300 : 400;
  const qualitySorted = strictFlights
    .map(f => ({
      ...f,
      qualityScore: (f.combinedDurationMinutes || f.totalDurationMinutes) + 
                    (f.outbound.stops + (f.inbound?.stops || 0)) * 120
    }))
    .sort((a, b) => {
      // PRIORITY 1: Prefer NEGOTIATED (package) fares when comparable price
      const isANegotiated = a.fareType === 'NEGOTIATED';
      const isBNegotiated = b.fareType === 'NEGOTIATED';
      
      if (isANegotiated && !isBNegotiated) {
        if (a.price <= b.price + packageTolerance) return -1;
      }
      if (!isANegotiated && isBNegotiated) {
        if (b.price <= a.price + packageTolerance) return 1;
      }
      
      // PRIORITY 2: Sort by quality score ONLY (duration + stops, NO price)
      return a.qualityScore - b.qualityScore;
    });

  let bestQuality: ProcessedFlight | null = null;
  if (qualitySorted.length > 0 && bestAndCheapest) {
    const topQuality = qualitySorted[0];
    
    // CRITICAL RULE: "Beste" can NEVER be cheaper than "Beste og billigste"
    // If it would be cheaper, show bestAndCheapest in both categories (confirms it's the best!)
    if (topQuality.price < bestAndCheapest.price) {
      bestQuality = bestAndCheapest; // Same flight in both categories
    } else {
      // Same price or more expensive - show as "Beste"
      bestQuality = topQuality;
    }
  }

  // RESULT 3: Cheapest (≤25h, NO night flights)
  // This is the CHEAPEST within extended time - allows longer duration but NO night flights!
  const extendedFlights = validFlights.filter(f =>
    f.totalDurationMinutes <= MAX_EXTENDED_DURATION_HOURS * 60 && !f.hasNightFlight
  );
  
  const sortedByPrice = [...extendedFlights].sort((a, b) => {
    // PRIORITY 1: Prefer NEGOTIATED (package) fares when comparable price
    const isANegotiated = a.fareType === 'NEGOTIATED';
    const isBNegotiated = b.fareType === 'NEGOTIATED';
    
    if (isANegotiated && !isBNegotiated) {
      // A is package, B is public: choose A if within tolerance
      if (a.price <= b.price + PACKAGE_FARE_TOLERANCE) return -1;
    }
    if (!isANegotiated && isBNegotiated) {
      // B is package, A is public: choose B if within tolerance
      if (b.price <= a.price + PACKAGE_FARE_TOLERANCE) return 1;
    }
    
    // PRIORITY 2: If prices are within 300 kr, prioritize by combined duration
    if (Math.abs(a.price - b.price) <= 300) {
      const aDuration = a.combinedDurationMinutes || a.totalDurationMinutes;
      const bDuration = b.combinedDurationMinutes || b.totalDurationMinutes;
      return aDuration - bDuration;
    }
    // PRIORITY 3: Otherwise sort by price
    return a.price - b.price;
  });
  
  // Show the cheapest (within extended time, but NO night flights)
  const cheapestExtended: ProcessedFlight | null = sortedByPrice.length > 0 ? sortedByPrice[0] : null;

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
  
  // Dynamic description based on departure airport (computed after departure state)
  const maxStrictHours = getMaxStrictDurationHours(departure || 'OSL');
  const mainResultsDesc = language === 'da' 
    ? `Max ${maxStrictHours}t rejsetid, ingen natfly (00:30-05:50)`
    : `Max ${maxStrictHours}t reisetid, ingen nattfly (00:30-05:50)`;
  const noMainResultsCriteria = language === 'da'
    ? `Ingen flyrejser indenfor hovedkriterier (max ${maxStrictHours}t, ingen natfly 00:30-05:50)`
    : `Ingen flyreiser innenfor hovedkriterier (max ${maxStrictHours}t, ingen nattfly 00:30-05:50)`;
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

  // Preferred airline option - CHANGED TO MULTI-SELECT
  const [usePreferredAirline, setUsePreferredAirline] = useState(false);
  const [selectedAirlines, setSelectedAirlines] = useState<string[]>([]); // Multi-select
  const [hasPreferredAirlineResults, setHasPreferredAirlineResults] = useState(false);

  // NEW: Abort controller for cancelling search
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Search progress tracking
  const [searchProgress, setSearchProgress] = useState({ current: 0, max: 0 });

  // NEW: Children checkbox state

  // Date interval option
  const [useDateInterval, setUseDateInterval] = useState(false);
  const [earliestDeparture, setEarliestDeparture] = useState<Date | undefined>(undefined);
  const [latestDeparture, setLatestDeparture] = useState<Date | undefined>(undefined);
  const [earliestDateOpen, setEarliestDateOpen] = useState(false);
  const [latestDateOpen, setLatestDateOpen] = useState(false);
  const [earliestDateInput, setEarliestDateInput] = useState("");
  const [latestDateInput, setLatestDateInput] = useState("");

  // Results - nå fra Zustand store med auto-persist
  const { savedFlights, addFlight, clearFlights } = useFlightInfo();
  const {
    mainResults,
    bestQualityResult,
    cheapestExtendedResult,
    flexibleResult,
    addNightsResult,
    removeNightsResult,
    dateIntervalResult,
    setMainResults,
    setBestQualityResult,
    setCheapestExtendedResult,
    setFlexibleResult,
    setAddNightsResult,
    setRemoveNightsResult,
    setDateIntervalResult,
    setHasSearched,
    resetAll: resetFlightStore,
  } = useFlightStore();
  const hasSearched = useFlightStore(state => state.hasSearched);

  // Preferred airline results (separate state since they're shown alongside regular results)
  const [preferredAirlineResults, setPreferredAirlineResults] = useState<{
    bestAndCheapest: ProcessedFlight | null;
    bestQuality: ProcessedFlight | null;
    cheapestExtended: ProcessedFlight | null;
    flexible: ProcessedFlight | null;
    addNights: ProcessedFlight | null;
    removeNights: ProcessedFlight | null;
    dateInterval: ProcessedFlight | null;
  }>({
    bestAndCheapest: null,
    bestQuality: null,
    cheapestExtended: null,
    flexible: null,
    addNights: null,
    removeNights: null,
    dateInterval: null,
  });

  // Clear search results on app startup
  useEffect(() => {
    resetFlightStore();
  }, [resetFlightStore]);

  // Listen for Farewise EK debug data from electron-main
  useEffect(() => {
    // @ts-expect-error - electron API
    const removeListener = window.electron?.on?.('farewise:debug-ek', (debugData: any) => {
      console.log('\n🔥 RAW FAREWISE EMIRATES DATA FROM API:');
      console.log('Total EK flights:', debugData.count);
      console.log('First EK flight FULL object:', debugData.firstFlight);
      console.log('Available fields:', debugData.fields);
      console.log('\n📋 Checking fare type fields:');
      console.log('fareType:', debugData.firstFlight?.fareType);
      console.log('priceType:', debugData.firstFlight?.priceType);
      console.log('type:', debugData.firstFlight?.type);
      console.log('price object:', debugData.firstFlight?.price);
      console.log('\n📋 Checking duration fields:');
      if (debugData.firstFlight?.legs?.[0]?.routes?.[0]) {
        const route = debugData.firstFlight.legs[0].routes[0];
        console.log('route.duration:', route.duration);
        console.log('route.elapsedTime:', route.elapsedTime);
        console.log('route object keys:', Object.keys(route));
      }
    });
    
    return () => {
      removeListener?.();
    };
  }, []);

  // Reset all state when language changes (NO ↔ DK)
  useEffect(() => {
    console.log(`🌐 Language changed to ${language}, resetting all state...`);
    // Reset dates
    setDepartureDate(undefined);
    setReturnDate(undefined);
    setDepartureDateInput("");
    setReturnDateInput("");
    
    // Reset airports to defaults
    setDeparture(language === "da" ? "CPH" : "OSL");
    setReturnTo(language === "da" ? "CPH" : "OSL");
    setDestination("JRO");
    setReturnFrom("ZNZ");
    
    // Reset airline selection
    setUsePreferredAirline(false);
    setSelectedAirlines([]);
    
    // Reset flexible options
    setFlexibleDates(false);
    setAddNights(false);
    setRemoveNights(false);
    setUseDateInterval(false);
    setEarliestDeparture(undefined);
    setLatestDeparture(undefined);
    setEarliestDateInput("");
    setLatestDateInput("");
    
    // Reset all flight results
    resetFlightStore();
    clearFlights();
    setPreferredAirlineResults({
      bestAndCheapest: null,
      bestQuality: null,
      cheapestExtended: null,
      flexible: null,
      addNights: null,
      removeNights: null,
      dateInterval: null,
    });
    setHasPreferredAirlineResults(false);
    setError(null);
  }, [language]); // Runs when language changes

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
    setHasPreferredAirlineResults(false);
    setPreferredAirlineResults({
      bestAndCheapest: null,
      bestQuality: null,
      cheapestExtended: null,
      flexible: null,
      extendedStay: null,
      dateInterval: null,
    });
  }

  // Helper function to check if flight includes preferred airline
  function hasPreferredAirline(flight: ProcessedFlight, airlineCode: string): boolean {
    const hasOutbound = flight.outbound.airlines.includes(airlineCode);
    const hasInbound = flight.inbound?.airlines.includes(airlineCode) ?? false;
    const result = hasOutbound || hasInbound;
    
    // Debug logging for EK
    if (airlineCode === 'EK' && result) {
      console.log(`✅ Found ${airlineCode} flight:`, {
        id: flight.id,
        price: flight.price,
        outboundAirlines: flight.outbound.airlines,
        inboundAirlines: flight.inbound?.airlines,
        outboundDuration: flight.outbound.duration,
        hasNightFlight: flight.hasNightFlight
      });
    }
    
    return result;
  }

  // Helper function to find best flight with preferred airline from a list
  function findBestWithPreferredAirline(
    flights: ProcessedFlight[], 
    airlineCode: string,
    sortBy: 'price' | 'quality' = 'price',
    category: 'strict' | 'extended' = 'strict',
    departureAirport: string = departure,
    userLanguage: 'no' | 'da' = language
  ): ProcessedFlight | null {
    const MAX_STRICT_DURATION_HOURS = getMaxStrictDurationHours(departureAirport);
    
    // Filter by airline first
    let filtered = flights.filter(f => hasPreferredAirline(f, airlineCode));
    console.log(`  ${airlineNames[airlineCode]} (${airlineCode}): ${filtered.length} flights found with this airline`);
    
    if (filtered.length === 0) return null;
    
    // Filter by max duration (25 hours for all)
    filtered = filtered.filter(f => f.totalDurationMinutes <= MAX_EXTENDED_DURATION_HOURS * 60);
    
    // Filter Oslo layover (NO only)
    if (userLanguage === 'no') {
      filtered = filtered.filter(f => f.hasInvalidOsloLayover !== true);
    }
    
    if (filtered.length === 0) {
      console.log(`    No flights ≤25h found`);
      return null;
    }
    
    // For strict categories, prefer flights ≤20h/22h (based on departure) with no night flights, but fallback if none exist
    if (category === 'strict') {
      const strictFiltered = filtered.filter(f => 
        f.totalDurationMinutes <= MAX_STRICT_DURATION_HOURS * 60 && !f.hasNightFlight
      );
      console.log(`    Strict flights (≤${MAX_STRICT_DURATION_HOURS}h, no night): ${strictFiltered.length}/${filtered.length}`);
      
      // Use strict flights if available, otherwise use all valid flights
      if (strictFiltered.length > 0) {
        filtered = strictFiltered;
      } else {
        console.log(`    No strict flights found, using extended criteria (≤25h)`);
      }
    }
    
    // PRIORITIZE NEGOTIATED (package) FARES
    // Rule: If a NEGOTIATED fare is within 300 kr of PUBLIC fare, choose NEGOTIATED
    const PACKAGE_FARE_TOLERANCE = 300;
    
    if (sortBy === 'price') {
      return filtered.reduce((best, current) => {
        // Both NEGOTIATED: compare price
        if (best.fareType === 'NEGOTIATED' && current.fareType === 'NEGOTIATED') {
          return current.price < best.price ? current : best;
        }
        // Both PUBLIC: compare price
        if (best.fareType !== 'NEGOTIATED' && current.fareType !== 'NEGOTIATED') {
          return current.price < best.price ? current : best;
        }
        // One is NEGOTIATED, one is PUBLIC
        if (current.fareType === 'NEGOTIATED') {
          // Current is package: choose if ≤300 kr more expensive than best
          return current.price <= best.price + PACKAGE_FARE_TOLERANCE ? current : best;
        } else {
          // Best is package: keep if ≤300 kr more expensive than current
          return best.price <= current.price + PACKAGE_FARE_TOLERANCE ? best : current;
        }
      });
    } else {
      // For quality: prioritize shorter duration, then fareType, then price
      return filtered.reduce((best, current) => {
        if (current.totalDurationMinutes < best.totalDurationMinutes) return current;
        if (current.totalDurationMinutes === best.totalDurationMinutes) {
          // Same duration: prefer NEGOTIATED if within tolerance
          if (best.fareType === 'NEGOTIATED' && current.fareType !== 'NEGOTIATED') {
            return best.price <= current.price + PACKAGE_FARE_TOLERANCE ? best : current;
          }
          if (current.fareType === 'NEGOTIATED' && best.fareType !== 'NEGOTIATED') {
            return current.price <= best.price + PACKAGE_FARE_TOLERANCE ? current : best;
          }
          // Same fare type or both public: compare price
          return current.price < best.price ? current : best;
        }
        return best;
      });
    }
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
      
      // Add flight slide to global store instead of localStorage
      // This makes it show up in "Valgte slides" in Bygg Reiseprogram
      addFlightSlide(flightData, language);
      
      toast.success(
        language === "no" 
          ? "Flyinformasjon lagt til! Se under 'Valgte slides' i Bygg reiseprogram." 
          : "Flyinformation tilføjet! Se under 'Valgte slides' i Byg rejseprogram."
      );
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
      if (bestQualityResult) {
        addFlightInfo(bestQualityResult, t.beste);
      }
      if (cheapestExtendedResult) {
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

  // Cancel search handler
  function handleCancelSearch() {
    if (abortController) {
      console.log('🛑 Cancelling search...');
      abortController.abort();
      setAbortController(null);
      setIsSearching(false);
      setSearchProgress({ current: 0, max: 0 });
      toast.info(language === "no" ? "Søket ble avbrutt" : "Søgningen blev afbrudt");
    }
  }

  // Main search handler
  async function handleSearch() {
    if (!departure || !departureDateStr || !returnDateStr) {
      toast.error(t.fillFields);
      return;
    }

    // Create new abort controller for this search
    const newAbortController = new AbortController();
    setAbortController(newAbortController);

    // Calculate max expected results based on enabled options
    let maxResults = 3; // 3 main categories always
    if (flexibleDates) maxResults += 1;
    if (addNights || removeNights) maxResults += 1;
    if (useDateInterval) maxResults += 1;
    if (usePreferredAirline && selectedAirlines.length > 0) {
      maxResults += 3; // Up to 3 preferred airline categories
    }
    
    // Cap at 7 for display purposes
    maxResults = Math.min(maxResults, 7);
    
    setSearchProgress({ current: 0, max: maxResults });
    setIsSearching(true);
    setError(null);
    setHasSearched(true);
    
    // Clear all previous results before starting new search
    clearFlights();
    setMainResults({ bestAndCheapest: null, cheapest: null });
    setBestQualityResult(null);
    setCheapestExtendedResult(null);
    setFlexibleResult(null);
    setAddNightsResult(null);
    setRemoveNightsResult(null);
    setDateIntervalResult(null);

    const currency = language === "da" ? "DKK" : "NOK";
    const pax = parseInt(passengers);

    try {
      // 1. MAIN SEARCH - Always runs, always shows 3 categories
      console.log('🔍 SEARCH START:', { departure, destination, returnFrom, returnTo, departureDateStr, returnDateStr, pax, currency });
      const mainOffers = await searchFlightsApi(departure, destination, returnFrom, returnTo, departureDateStr, returnDateStr, pax, currency);
      console.log('📡 API RESPONSE:', mainOffers.length, 'offers received');
      const processedFlights = processFlightOffers(mainOffers, undefined, pax);
      console.log('⚙️ PROCESSED:', processedFlights.length, 'flights after processing');
      const categories = categorizeFlights(processedFlights, t, departure, language);

      // Set all 3 mandatory categories
      setMainResults({ bestAndCheapest: categories.bestAndCheapest, cheapest: null });
      setBestQualityResult(categories.bestQuality);
      setCheapestExtendedResult(categories.cheapestExtended);
      
      let foundCount = 0;
      if (categories.bestAndCheapest) {
        addFlight(toFlightInfo(categories.bestAndCheapest, t.bestAndCheapest));
        foundCount++;
        setSearchProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      if (categories.bestQuality) {
        addFlight(toFlightInfo(categories.bestQuality, t.beste));
        foundCount++;
        setSearchProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      if (categories.cheapestExtended) {
        addFlight(toFlightInfo(categories.cheapestExtended, t.cheapest));
        foundCount++;
        setSearchProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      // Note: Extra search results (flexible dates, add/remove nights, intervals) are added
      // directly via addFlight() in their respective search functions below

      const basePrice = categories.bestAndCheapest?.price || Infinity;

      // 1.5. PREFERRED AIRLINE SEARCH - Find best alternatives with selected airlines
      if (usePreferredAirline && selectedAirlines.length > 0) {
        console.log('✈️ SELECTED AIRLINES:', selectedAirlines.map(code => `${airlineNames[code]} (${code})`).join(', '));
        console.log('Total processed flights:', processedFlights.length);
        
        // Log all unique airlines in results for debugging
        const allAirlines = new Set<string>();
        processedFlights.forEach(f => {
          f.outbound.airlines.forEach(a => allAirlines.add(a));
          f.inbound?.airlines.forEach(a => allAirlines.add(a));
        });
        console.log('Airlines available in results (IATA codes):', Array.from(allAirlines).map(code => `${airlineNames[code] || code} (${code})`).join(', '));
        
        let hasAnyPreferredResults = false;
        const preferredResults: typeof preferredAirlineResults = {
          bestAndCheapest: null,
          bestQuality: null,
          cheapestExtended: null,
          flexible: null,
          addNights: null,
          removeNights: null,
          dateInterval: null,
        };

        // Find best alternatives for each selected airline
        for (const airlineCode of selectedAirlines) {
          const airlineName = airlineNames[airlineCode];
          console.log(`\n🔍 Searching for ${airlineName} (${airlineCode})...`);
          
          // Apply same constraints as main categories
          const preferredBestAndCheapest = findBestWithPreferredAirline(processedFlights, airlineCode, 'price', 'strict');
          const preferredBestQuality = findBestWithPreferredAirline(processedFlights, airlineCode, 'quality', 'strict');
          const preferredCheapestExtended = findBestWithPreferredAirline(processedFlights, airlineCode, 'price', 'extended');
          
          console.log(`Found with ${airlineName}:`, {
            bestAndCheapest: preferredBestAndCheapest ? `YES (${preferredBestAndCheapest.price} kr, ${Math.round(preferredBestAndCheapest.totalDurationMinutes / 60)}h)` : 'NO',
            bestQuality: preferredBestQuality ? `YES (${preferredBestQuality.price} kr, ${Math.round(preferredBestQuality.totalDurationMinutes / 60)}h)` : 'NO',
            cheapestExtended: preferredCheapestExtended ? `YES (${preferredCheapestExtended.price} kr, ${Math.round(preferredCheapestExtended.totalDurationMinutes / 60)}h)` : 'NO'
          });

          // Always add to flight info if they exist (even if same as main results)
          if (preferredBestAndCheapest) {
            console.log(`Adding ${airlineName} bestAndCheapest to flight info`);
            addFlight(toFlightInfo(preferredBestAndCheapest, `${airlineName} - ${t.bestAndCheapest}`));
            hasAnyPreferredResults = true;
            if (!preferredResults.bestAndCheapest) {
              setSearchProgress(prev => ({ ...prev, current: prev.current + 1 }));
            }
          }
          if (preferredBestQuality) {
            console.log(`Adding ${airlineName} bestQuality to flight info`);
            addFlight(toFlightInfo(preferredBestQuality, `${airlineName} - ${t.beste}`));
            hasAnyPreferredResults = true;
            if (!preferredResults.bestQuality) {
              setSearchProgress(prev => ({ ...prev, current: prev.current + 1 }));
            }
          }
          if (preferredCheapestExtended) {
            console.log(`Adding ${airlineName} cheapestExtended to flight info`);
            addFlight(toFlightInfo(preferredCheapestExtended, `${airlineName} - ${t.cheapest}`));
            hasAnyPreferredResults = true;
            if (!preferredResults.cheapestExtended) {
              setSearchProgress(prev => ({ ...prev, current: prev.current + 1 }));
            }
          }

          // Keep track of overall best preferred results (for display purposes)
          if (preferredBestAndCheapest && (!preferredResults.bestAndCheapest || preferredBestAndCheapest.price < preferredResults.bestAndCheapest.price)) {
            preferredResults.bestAndCheapest = { ...preferredBestAndCheapest, recommendReason: `${airlineName} - ${t.bestAndCheapest}` };
          }
          if (preferredBestQuality && (!preferredResults.bestQuality || preferredBestQuality.totalDurationMinutes < preferredResults.bestQuality.totalDurationMinutes)) {
            preferredResults.bestQuality = { ...preferredBestQuality, recommendReason: `${airlineName} - ${t.beste}` };
          }
          if (preferredCheapestExtended && (!preferredResults.cheapestExtended || preferredCheapestExtended.price < preferredResults.cheapestExtended.price)) {
            preferredResults.cheapestExtended = { ...preferredCheapestExtended, recommendReason: `${airlineName} - ${t.cheapest}` };
          }
        }
        
        setPreferredAirlineResults(preferredResults);
        setHasPreferredAirlineResults(hasAnyPreferredResults);
        console.log('Has any preferred results:', hasAnyPreferredResults);
      }

      // 2. FLEXIBLE DATES SEARCH (±X days, same number of nights) - Sequential to avoid rate limiting
      if (flexibleDates && flexibleNights > 0) {
        let bestFlex: ProcessedFlight | null = null;
        const allFlexFlights: ProcessedFlight[] = []; // Collect all flights for preferred airline search

        // Search ALL date variations to find BEST option using SCORE (not just price!)
        for (let i = -flexibleNights; i <= flexibleNights; i++) {
          if (i === 0) continue;
          const newDepDate = addDays(departureDateStr, i);
          const newRetDate = addDays(returnDateStr, i);

          try {
            const offers = await searchFlightsApi(departure, destination, returnFrom, returnTo, newDepDate, newRetDate, pax, currency);
            const processed = processFlightOffers(offers, { date: newDepDate, nightsDiff: 0 }, pax);
            // Allow longer flights with night layovers, but exclude problematic endpoints
            let valid = processed.filter(f =>
              f.totalDurationMinutes <= MAX_EXTENDED_DURATION_HOURS * 60 && !f.hasNightFlight
            );
            
            // Filter Oslo layover (NO only)
            if (language === 'no') {
              valid = valid.filter(f => f.hasInvalidOsloLayover !== true);
            }

            allFlexFlights.push(...valid); // Store for preferred airline search

            // Find BEST AND CHEAPEST (lowest score) across all date variations
            for (const flight of valid) {
              const flightScore = calculateFlightScore(flight);
              if (!bestFlex || flightScore < calculateFlightScore(bestFlex)) {
                bestFlex = { ...flight, searchDate: newDepDate };
              }
            }
          } catch (err) {
            console.log(`Flex search for ${newDepDate} failed:`, err);
          }
        }

        // ALWAYS show the best flexible option (by score) - even if more expensive!
        // User wants to see the result if the checkbox is enabled
        if (bestFlex) {
          setFlexibleResult({ ...bestFlex, recommendReason: t.cheaperFlexible });
          setSearchProgress(prev => ({ ...prev, current: prev.current + 1 }));
        }
        
        // Find best flexible option for each selected airline
        if (usePreferredAirline && selectedAirlines.length > 0 && allFlexFlights.length > 0) {
          for (const airlineCode of selectedAirlines) {
            const airlineName = airlineNames[airlineCode];
            const preferredFlexFlights = allFlexFlights.filter(f => hasPreferredAirline(f, airlineCode));
            
            if (preferredFlexFlights.length > 0) {
              const preferredFlex = preferredFlexFlights.reduce((best, current) => 
                current.price < best.price ? current : best
              );
              
              if (preferredFlex.price < basePrice) {
                setPreferredAirlineResults(prev => ({
                  ...prev,
                  flexible: preferredFlex.price < (prev.flexible?.price || Infinity) 
                    ? { ...preferredFlex, recommendReason: `${airlineName} - ${t.cheaperFlexible}` }
                    : prev.flexible
                }));
                setHasPreferredAirlineResults(true);
                addFlight(toFlightInfo(preferredFlex, `${airlineName} - ${t.cheaperFlexible}`));
                setSearchProgress(prev => ({ ...prev, current: prev.current + 1 }));
              }
            }
          }
        }
      }

      // 3A. ADD NIGHTS SEARCH (extend trip if cheaper)
      console.log('🔍 ADD NIGHTS CHECK:', { addNights, addNightsCount, willRun: addNights && addNightsCount > 0 });
      if (addNights && addNightsCount > 0) {
        let bestAdd: ProcessedFlight | null = null;
        const allAddFlights: ProcessedFlight[] = []; // Collect all flights for preferred airline search

        // Search ALL variations (1, 2, 3, ... addNightsCount) to find the BEST option using SCORE (not just price!)
        for (let i = 1; i <= addNightsCount; i++) {
          const newRetDate = addDays(returnDateStr, i);
          console.log(`  📅 Searching +${i} nights, new return date: ${newRetDate}`);

          try {
            const offers = await searchFlightsApi(departure, destination, returnFrom, returnTo, departureDateStr, newRetDate, pax, currency);
            const processed = processFlightOffers(offers, { date: departureDateStr, nightsDiff: i }, pax);
            console.log(`  ✈️ Found ${processed.length} processed flights for +${i} nights`);
            
            let valid = processed.filter(f =>
              f.totalDurationMinutes <= MAX_EXTENDED_DURATION_HOURS * 60 && !f.hasNightFlight
            );
            console.log(`  ✅ After filters: ${valid.length} valid flights (≤25h, no night flights)`);
            
            // Filter Oslo layover (NO only)
            if (language === 'no') {
              valid = valid.filter(f => f.hasInvalidOsloLayover !== true);
              console.log(`  🇳🇴 After Oslo filter: ${valid.length} valid flights`);
            }

            allAddFlights.push(...valid); // Store for preferred airline search

            // Find BEST AND CHEAPEST (lowest score) across ALL night variations
            for (const flight of valid) {
              flight.nightsDiff = i; // Tag with number of extra nights
              const flightScore = calculateFlightScore(flight);
              if (!bestAdd || flightScore < calculateFlightScore(bestAdd)) {
                bestAdd = flight;
                console.log(`  🏆 New best add nights flight: +${i} nights, price: ${flight.price}, score: ${flightScore}`);
              }
            }
          } catch (err) {
            console.log(`❌ Add nights search for ${newRetDate} failed:`, err);
          }
        }

        // ALWAYS show the best option (by score) - even if more expensive!
        // User wants to see the result if the checkbox is enabled
        if (bestAdd) {
          console.log('✅ Setting addNightsResult:', { nightsDiff: bestAdd.nightsDiff, price: bestAdd.price });
          setAddNightsResult({ ...bestAdd, recommendReason: t.cheaperExtended });
          setSearchProgress(prev => ({ ...prev, current: prev.current + 1 }));
        } else {
          console.log('⚠️ No valid add nights results found');
        }
      }
        
        // Find best add nights option for each selected airline
        if (usePreferredAirline && selectedAirlines.length > 0 && allAddFlights.length > 0) {
          for (const airlineCode of selectedAirlines) {
            const airlineName = airlineNames[airlineCode];
            const preferredAddFlights = allAddFlights.filter(f => hasPreferredAirline(f, airlineCode));
            
            if (preferredAddFlights.length > 0) {
              const preferredAdd = preferredAddFlights.reduce((best, current) => 
                current.price < best.price ? current : best
              );
              
              if (preferredAdd.price < basePrice) {
                setPreferredAirlineResults(prev => ({
                  ...prev,
                  addNights: preferredAdd.price < (prev.addNights?.price || Infinity)
                    ? { ...preferredAdd, recommendReason: `${airlineName} - ${t.cheaperExtended}` }
                    : prev.addNights
                }));
                setHasPreferredAirlineResults(true);
                addFlight(toFlightInfo(preferredAdd, `${airlineName} - ${t.cheaperExtended}`));
                setSearchProgress(prev => ({ ...prev, current: prev.current + 1 }));
              }
            }
          }
        }
      }

      // 3B. REMOVE NIGHTS SEARCH (shorten trip if cheaper)
      console.log('🔍 REMOVE NIGHTS CHECK:', { removeNights, removeNightsCount, willRun: removeNights && removeNightsCount > 0 });
      if (removeNights && removeNightsCount > 0) {
        let bestRemove: ProcessedFlight | null = null;
        const allRemoveFlights: ProcessedFlight[] = []; // Collect all flights for preferred airline search

        // Search ALL variations (-1, -2, -3, ... -removeNightsCount) to find the BEST option using SCORE (not just price!)
        for (let i = 1; i <= removeNightsCount; i++) {
          const newRetDate = addDays(returnDateStr, -i);
          console.log(`  📅 Searching -${i} nights, new return date: ${newRetDate}`);

          try {
            const offers = await searchFlightsApi(departure, destination, returnFrom, returnTo, departureDateStr, newRetDate, pax, currency);
            const processed = processFlightOffers(offers, { date: departureDateStr, nightsDiff: -i }, pax);
            console.log(`  ✈️ Found ${processed.length} processed flights for -${i} nights`);
            
            let valid = processed.filter(f =>
              f.totalDurationMinutes <= MAX_EXTENDED_DURATION_HOURS * 60 && !f.hasNightFlight
            );
            console.log(`  ✅ After filters: ${valid.length} valid flights (≤25h, no night flights)`);
            
            // Filter Oslo layover (NO only)
            if (language === 'no') {
              valid = valid.filter(f => f.hasInvalidOsloLayover !== true);
              console.log(`  🇳🇴 After Oslo filter: ${valid.length} valid flights`);
            }

            allRemoveFlights.push(...valid); // Store for preferred airline search

            // Find BEST AND CHEAPEST (lowest score) across ALL night variations
            for (const flight of valid) {
              flight.nightsDiff = -i; // Tag with number of removed nights (negative)
              const flightScore = calculateFlightScore(flight);
              if (!bestRemove || flightScore < calculateFlightScore(bestRemove)) {
                bestRemove = flight;
                console.log(`  🏆 New best remove nights flight: -${i} nights, price: ${flight.price}, score: ${flightScore}`);
              }
            }
          } catch (err) {
            console.log(`❌ Remove nights search for ${newRetDate} failed:`, err);
          }
        }

        // ALWAYS show the best option (by score) - even if more expensive!
        // User wants to see the result if the checkbox is enabled
        if (bestRemove) {
          console.log('✅ Setting removeNightsResult:', { nightsDiff: bestRemove.nightsDiff, price: bestRemove.price });
          setRemoveNightsResult({ ...bestRemove, recommendReason: t.cheaperExtended });
          setSearchProgress(prev => ({ ...prev, current: prev.current + 1 }));
        } else {
          console.log('⚠️ No valid remove nights results found');
        }
      }
        
        // Find best remove nights option for each selected airline
        if (usePreferredAirline && selectedAirlines.length > 0 && allRemoveFlights.length > 0) {
          for (const airlineCode of selectedAirlines) {
            const airlineName = airlineNames[airlineCode];
            const preferredRemoveFlights = allRemoveFlights.filter(f => hasPreferredAirline(f, airlineCode));
            
            if (preferredRemoveFlights.length > 0) {
              const preferredRemove = preferredRemoveFlights.reduce((best, current) => 
                current.price < best.price ? current : best
              );
              
              if (preferredRemove.price < basePrice) {
                setPreferredAirlineResults(prev => ({
                  ...prev,
                  removeNights: preferredRemove.price < (prev.removeNights?.price || Infinity)
                    ? { ...preferredRemove, recommendReason: `${airlineName} - ${t.cheaperExtended}` }
                    : prev.removeNights
                }));
                setHasPreferredAirlineResults(true);
                addFlight(toFlightInfo(preferredRemove, `${airlineName} - ${t.cheaperExtended}`));
                setSearchProgress(prev => ({ ...prev, current: prev.current + 1 }));
              }
            }
          }
        }
      }

      // 4. DATE INTERVAL SEARCH (search all dates in range with same number of nights)
      if (useDateInterval && earliestDeparture && latestDeparture) {
        const tripNights = calculateNights(departureDateStr, returnDateStr);
        let bestInterval: ProcessedFlight | null = null;
        const allIntervalFlights: ProcessedFlight[] = []; // Collect all flights for preferred airline search

        // Calculate number of days in the interval
        const startDate = new Date(earliestDeparture);
        const endDate = new Date(latestDeparture);
        const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

        // Search ALL dates in interval to find BEST option using SCORE (not just price!)
        for (let i = 0; i <= daysDiff; i++) {
          const searchDepDate = format(new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
          const searchRetDate = addDays(searchDepDate, tripNights);

          // Skip if this is the original search date
          if (searchDepDate === departureDateStr) continue;

          try {
            const offers = await searchFlightsApi(departure, destination, returnFrom, returnTo, searchDepDate, searchRetDate, pax, currency);
            const processed = processFlightOffers(offers, { date: searchDepDate, nightsDiff: 0 }, pax);
            // Allow longer flights with night layovers, but exclude problematic endpoints
            let valid = processed.filter(f =>
              f.totalDurationMinutes <= MAX_EXTENDED_DURATION_HOURS * 60 && !f.hasNightFlight
            );
            
            // Filter Oslo layover (NO only)
            if (language === 'no') {
              valid = valid.filter(f => f.hasInvalidOsloLayover !== true);
            }

            allIntervalFlights.push(...valid); // Store for preferred airline search

            // Find BEST AND CHEAPEST (lowest score) across all dates in interval
            for (const flight of valid) {
              const flightScore = calculateFlightScore(flight);
              if (!bestInterval || flightScore < calculateFlightScore(bestInterval)) {
                bestInterval = { ...flight, searchDate: searchDepDate };
              }
            }
          } catch (err) {
            console.log(`Interval search for ${searchDepDate} failed:`, err);
          }
        }

        // ALWAYS show the best interval option (by score) - even if more expensive!
        // User wants to see the result if the checkbox is enabled
        if (bestInterval) {
          setDateIntervalResult({ ...bestInterval, recommendReason: t.searchInInterval });
          setSearchProgress(prev => ({ ...prev, current: prev.current + 1 }));
        }
        
        // Find best interval option for each selected airline
        if (usePreferredAirline && selectedAirlines.length > 0 && allIntervalFlights.length > 0) {
          for (const airlineCode of selectedAirlines) {
            const airlineName = airlineNames[airlineCode];
            const preferredIntervalFlights = allIntervalFlights.filter(f => hasPreferredAirline(f, airlineCode));
            
            if (preferredIntervalFlights.length > 0) {
              const preferredInterval = preferredIntervalFlights.reduce((best, current) => 
                current.price < best.price ? current : best
              );
              
              if (preferredInterval.price < basePrice) {
                setPreferredAirlineResults(prev => ({
                  ...prev,
                  dateInterval: preferredInterval.price < (prev.dateInterval?.price || Infinity)
                    ? { ...preferredInterval, recommendReason: `${airlineName} - ${t.searchInInterval}` }
                    : prev.dateInterval
                }));
                setHasPreferredAirlineResults(true);
                addFlight(toFlightInfo(preferredInterval, `${airlineName} - ${t.searchInInterval}`));
                setSearchProgress(prev => ({ ...prev, current: prev.current + 1 }));
              }
            }
          }
        }
      }

      // Toast notification
      if (categories.bestAndCheapest || categories.bestQuality || categories.cheapestExtended) {
        toast.success(language === "no" ? "Flyreiser funnet!" : "Flyrejser fundet!");
      } else {
        toast.info(t.noResults);
      }

    } catch (err) {
      // Don't show error if search was manually aborted
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Search was aborted by user');
        return;
      }
      
      console.error("Flight search error:", err);
      setError(err instanceof Error ? err.message : t.error);
      toast.error(t.error);
    } finally {
      setIsSearching(false);
      setAbortController(null);
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
                <SelectContent position="popper" className="bg-background z-50 max-h-[300px] overflow-y-auto">
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
            
            {/* Children */}
            <div className="space-y-1">
              <Label>{t.children}</Label>
              <Select value={children} onValueChange={setChildren}>
                <SelectTrigger className="bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="bg-background z-50 max-h-[300px] overflow-y-auto">
                  {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  <PopoverContent className="w-auto p-0" side="bottom" align="start" avoidCollisions={false}>
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
                  <PopoverContent className="w-auto p-0" side="bottom" align="start" avoidCollisions={false}>
                    <Calendar
                      mode="single"
                      selected={returnDate}
                      month={departureDate || returnDate}
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
                  <SelectContent position="popper" className="bg-background z-50 max-h-[200px] overflow-y-auto">
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
                  <SelectContent position="popper" className="bg-background z-50 max-h-[200px] overflow-y-auto">
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
                  <SelectContent position="popper" className="bg-background z-50 max-h-[200px] overflow-y-auto">
                    {[1, 2, 3, 4, 5, 7].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {t.nightsLess}
              </Label>
            </div>

            {/* Preferred Airline - Multi-Select with Checkboxes */}
            <div className="col-span-1 md:col-span-2 w-full">
              <div className="flex items-center gap-2 mb-3">
                <Checkbox
                  id="preferredAirline"
                  checked={usePreferredAirline}
                  onCheckedChange={(checked) => setUsePreferredAirline(checked === true)}
                />
                <Label htmlFor="preferredAirline" className="cursor-pointer font-semibold">
                  {t.preferredAirline}
                </Label>
              </div>
              
              {usePreferredAirline && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pl-6 pb-2 border border-border/30 rounded-md p-3 bg-muted/10">
                  {Object.entries(airlineNames).map(([code, name]) => (
                    <div key={code} className="flex items-center gap-2">
                      <Checkbox
                        id={`airline-${code}`}
                        checked={selectedAirlines.includes(code)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedAirlines(prev => [...prev, code]);
                          } else {
                            setSelectedAirlines(prev => prev.filter(c => c !== code));
                          }
                        }}
                      />
                      <Label htmlFor={`airline-${code}`} className="cursor-pointer text-sm">
                        {name} ({code})
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Date Interval Option */}
            <div className="col-span-1 md:col-span-2 w-full pt-2 border-t border-border/30">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="dateInterval"
                    checked={useDateInterval}
                    onCheckedChange={(checked) => setUseDateInterval(checked === true)}
                  />
                  <Label htmlFor="dateInterval" className="cursor-pointer whitespace-nowrap">
                    {t.dateInterval}:
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground transition-colors">
                        <Info className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="flex gap-2">
                        <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-muted-foreground">
                          {t.dateIntervalInfo}
                        </p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                
                {/* Earliest departure */}
                <div className="space-y-1 flex-1 min-w-[180px]">
                  <Label>{t.earliestDeparture}</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="DDMM (f.eks. 0510)"
                      value={earliestDateInput}
                      onChange={(e) => setEarliestDateInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const parsed = parseDDMM(earliestDateInput);
                          if (parsed) {
                            setEarliestDeparture(parsed);
                            setEarliestDateInput(format(parsed, 'dd.MM.yyyy'));
                          }
                        }
                      }}
                      onBlur={() => {
                        const parsed = parseDDMM(earliestDateInput);
                        if (parsed) {
                          setEarliestDeparture(parsed);
                          setEarliestDateInput(format(parsed, 'dd.MM.yyyy'));
                        } else if (earliestDeparture) {
                          setEarliestDateInput(format(earliestDeparture, 'dd.MM.yyyy'));
                        }
                      }}
                      className="w-[120px] bg-muted/30 flex-1"
                      disabled={!useDateInterval}
                    />
                    <Popover open={earliestDateOpen} onOpenChange={setEarliestDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="bg-muted/30"
                          disabled={!useDateInterval}
                        >
                          <CalendarIcon className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" side="bottom" align="start" avoidCollisions={false}>
                        <Calendar
                          mode="single"
                          selected={earliestDeparture}
                          onSelect={(date) => {
                            setEarliestDeparture(date);
                            setEarliestDateInput(date ? format(date, 'dd.MM.yyyy') : '');
                            setEarliestDateOpen(false);
                          }}
                          disabled={(date) => date < today || date > maxDate}
                          initialFocus
                          locale={dayPickerLocale}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                
                {/* Arrow between dates */}
                <div className="flex items-center justify-center px-2">
                  <span className="text-muted-foreground text-lg">→</span>
                </div>
                
                {/* Latest departure */}
                <div className="space-y-1 flex-1 min-w-[180px]">
                  <Label>{t.latestDeparture}</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="DDMM (f.eks. 1510)"
                      value={latestDateInput}
                      onChange={(e) => setLatestDateInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const parsed = parseDDMM(latestDateInput);
                          if (parsed) {
                            setLatestDeparture(parsed);
                            setLatestDateInput(format(parsed, 'dd.MM.yyyy'));
                          }
                        }
                      }}
                      onBlur={() => {
                        const parsed = parseDDMM(latestDateInput);
                        if (parsed) {
                          setLatestDeparture(parsed);
                          setLatestDateInput(format(parsed, 'dd.MM.yyyy'));
                        } else if (latestDeparture) {
                          setLatestDateInput(format(latestDeparture, 'dd.MM.yyyy'));
                        }
                      }}
                      className="w-[120px] bg-muted/30 flex-1"
                      disabled={!useDateInterval}
                    />
                    <Popover open={latestDateOpen} onOpenChange={setLatestDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="bg-muted/30"
                          disabled={!useDateInterval}
                        >
                          <CalendarIcon className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" side="bottom" align="start" avoidCollisions={false}>
                        <Calendar
                          mode="single"
                          selected={latestDeparture}
                          month={earliestDeparture || latestDeparture}
                          onSelect={(date) => {
                            setLatestDeparture(date);
                            setLatestDateInput(date ? format(date, 'dd.MM.yyyy') : '');
                            setLatestDateOpen(false);
                          }}
                          disabled={(date) => {
                            const minDate = earliestDeparture || today;
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
            </div>

            {/* Search and Cancel Buttons */}
            <div className="mt-4 flex gap-3 justify-center">
              <Button
                onClick={handleSearch}
                disabled={isSearching}
                variant="outline"
                className="gap-2 border-2 border-primary min-w-[220px]"
                size="lg"
              >
                {isSearching ? (
                  <>
                    <Search className="h-4 w-4 animate-spin" />
                    {t.searching} ({searchProgress.current}/{searchProgress.max})
                  </>
                ) : (
                  <>
                    <Plane className="h-4 w-4" />
                    {t.search}
                  </>
                )}
              </Button>

              {/* Avslutt søk-knapp - vises mens søket pågår */}
              {isSearching && (
                <Button
                  onClick={handleCancelSearch}
                  variant="outline"
                  className="gap-2 border-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground min-w-[180px]"
                  size="lg"
                >
                  <AlertCircle className="h-4 w-4" />
                  {language === "no" ? "Avslutt søk" : "Afbryd søgning"}
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
                  <p className="text-xs text-muted-foreground">{mainResultsDesc}</p>
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
                  childrenCount={parseInt(children)}
                  hasNightFlight={mainResults.bestAndCheapest.hasNightFlight}
                />
              </div>
            </div>
          )}

          {/* PREFERRED AIRLINE: Best and Cheapest */}
          {usePreferredAirline && selectedAirlines.length > 0 && preferredAirlineResults.bestAndCheapest && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-blue-500 fill-blue-500" />
                <div>
                  <h3 className="font-semibold text-foreground">{preferredAirlineResults.bestAndCheapest.recommendReason}</h3>
                  <p className="text-xs text-muted-foreground">{mainResultsDesc}</p>
                </div>
              </div>
              <div className="relative">
                <FlightResultCard
                  flight={preferredAirlineResults.bestAndCheapest}
                  language={language}
                  translations={t}
                  formatTime={formatTime}
                  formatDate={formatDate}
                  formatDuration={formatDuration}
                  onSave={saveToPowerPointSingle}
                  title={preferredAirlineResults.bestAndCheapest.recommendReason || t.bestAndCheapest}
                  childrenCount={parseInt(children)}
                  hasNightFlight={preferredAirlineResults.bestAndCheapest.hasNightFlight}
                />
              </div>
            </div>
          )}

          {/* NO PREFERRED AIRLINE RESULTS for this category */}
          {usePreferredAirline && selectedAirlines.length > 0 && hasSearched && !preferredAirlineResults.bestAndCheapest && (
            <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    {language === "no" 
                      ? `Ingen ruter funnet for ${t.bestAndCheapest} med ${selectedAirlines.map(c => airlineNames[c]).join(', ')}`
                      : `Ingen ruter fundet for ${t.bestAndCheapest} med ${selectedAirlines.map(c => airlineNames[c]).join(', ')}`
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {/* CATEGORY 2: Best by Quality (≤22h, no night) */}
          {/* ALWAYS SHOW - even if same as bestAndCheapest (confirms it's the best!) */}
          {bestQualityResult && (
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
                childrenCount={parseInt(children)}
                hasNightFlight={bestQualityResult.hasNightFlight}
              />
            </div>
          )}

          {/* PREFERRED AIRLINE: Best by Quality */}
          {usePreferredAirline && selectedAirlines.length > 0 && preferredAirlineResults.bestQuality && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-blue-500" />
                <div>
                  <h3 className="font-semibold text-foreground">{preferredAirlineResults.bestQuality.recommendReason}</h3>
                  <p className="text-xs text-muted-foreground">{t.bestQualityDesc || "Best overall flight based on duration and connections"}</p>
                </div>
              </div>
              <FlightResultCard
                flight={preferredAirlineResults.bestQuality}
                language={language}
                translations={t}
                formatTime={formatTime}
                formatDate={formatDate}
                formatDuration={formatDuration}
                onSave={saveToPowerPointSingle}
                title={preferredAirlineResults.bestQuality.recommendReason || t.beste}
                childrenCount={parseInt(children)}
                hasNightFlight={preferredAirlineResults.bestQuality.hasNightFlight}
              />
            </div>
          )}

          {/* NO PREFERRED AIRLINE RESULTS for quality category */}
          {usePreferredAirline && selectedAirlines.length > 0 && hasSearched && !preferredAirlineResults.bestQuality && (
            <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    {language === "no" 
                      ? `Ingen ruter funnet for ${t.beste} med ${selectedAirlines.map(c => airlineNames[c]).join(', ')}`
                      : `Ingen ruter fundet for ${t.beste} med ${selectedAirlines.map(c => airlineNames[c]).join(', ')}`
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* CATEGORY 3: Cheapest (≤25h, NO night flights) */}
          {cheapestExtendedResult && (
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
                childrenCount={parseInt(children)}
                hasNightFlight={cheapestExtendedResult.hasNightFlight}
              />
            </div>
          )}

          {/* PREFERRED AIRLINE: Cheapest Extended */}
          {usePreferredAirline && selectedAirlines.length > 0 && preferredAirlineResults.cheapestExtended && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-blue-500" />
                <div>
                  <h3 className="font-semibold text-foreground">{preferredAirlineResults.cheapestExtended.recommendReason}</h3>
                  <p className="text-xs text-muted-foreground">{t.cheapestWithFlexibility || "Cheapest option up to 25 hours"}</p>
                </div>
              </div>
              <FlightResultCard
                flight={preferredAirlineResults.cheapestExtended}
                language={language}
                translations={t}
                formatTime={formatTime}
                formatDate={formatDate}
                formatDuration={formatDuration}
                onSave={saveToPowerPointSingle}
                title={preferredAirlineResults.cheapestExtended.recommendReason || t.cheapest}
                childrenCount={parseInt(children)}
                hasNightFlight={preferredAirlineResults.cheapestExtended.hasNightFlight}
              />
            </div>
          )}

          {/* NO PREFERRED AIRLINE RESULTS for cheapest extended category */}
          {usePreferredAirline && selectedAirlines.length > 0 && hasSearched && !preferredAirlineResults.cheapestExtended && (
            <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    {language === "no" 
                      ? `Ingen ruter funnet for ${t.cheapest} med ${selectedAirlines.map(c => airlineNames[c]).join(', ')}`
                      : `Ingen ruter fundet for ${t.cheapest} med ${selectedAirlines.map(c => airlineNames[c]).join(', ')}`
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
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
            childrenCount={parseInt(children)}
            hasNightFlight={flexibleResult.hasNightFlight}
          />
        </div>
      )}

      {/* PREFERRED AIRLINE: Flexible Date Result */}
      {usePreferredAirline && selectedAirlines.length > 0 && preferredAirlineResults.flexible && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-blue-500" />
            <div>
              <h3 className="font-semibold text-foreground">{preferredAirlineResults.flexible.recommendReason}</h3>
              {preferredAirlineResults.flexible.searchDate && (
                <p className="text-xs text-muted-foreground">
                  Avreise: {format(new Date(preferredAirlineResults.flexible.searchDate), "dd.MM.yyyy")}
                </p>
              )}
            </div>
          </div>
          <FlightResultCard
            flight={preferredAirlineResults.flexible}
            language={language}
            translations={t}
            formatTime={formatTime}
            formatDate={formatDate}
            formatDuration={formatDuration}
            onSave={saveToPowerPointSingle}
            title={preferredAirlineResults.flexible.recommendReason || t.cheaperFlexible}
            childrenCount={parseInt(children)}
            hasNightFlight={preferredAirlineResults.flexible.hasNightFlight}
          />
        </div>
      )}

      {/* ADD NIGHTS RESULT */}
      {addNightsResult && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold text-foreground">
                {t.cheaperExtended} {Math.abs(addNightsResult.nightsDiff || 0)} {t.extraNights}
              </h3>
              <p className="text-xs text-muted-foreground">
                Lengre opphold (+{Math.abs(addNightsResult.nightsDiff || 0)} netter)
              </p>
            </div>
          </div>
          <FlightResultCard
            flight={addNightsResult}
            language={language}
            translations={t}
            formatTime={formatTime}
            formatDate={formatDate}
            formatDuration={formatDuration}
            onSave={saveToPowerPointSingle}
            title={`${t.cheaperExtended} ${Math.abs(addNightsResult.nightsDiff || 0)} ${t.extraNights}`}
            childrenCount={parseInt(children)}
            hasNightFlight={addNightsResult.hasNightFlight}
          />
        </div>
      )}

      {/* REMOVE NIGHTS RESULT */}
      {removeNightsResult && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold text-foreground">
                {t.cheaperExtended} {Math.abs(removeNightsResult.nightsDiff || 0)} {t.fewerNights}
              </h3>
              <p className="text-xs text-muted-foreground">
                Kortere opphold (-{Math.abs(removeNightsResult.nightsDiff || 0)} netter)
              </p>
            </div>
          </div>
          <FlightResultCard
            flight={removeNightsResult}
            language={language}
            translations={t}
            formatTime={formatTime}
            formatDate={formatDate}
            formatDuration={formatDuration}
            onSave={saveToPowerPointSingle}
            title={`${t.cheaperExtended} ${Math.abs(removeNightsResult.nightsDiff || 0)} ${t.fewerNights}`}
            childrenCount={parseInt(children)}
            hasNightFlight={removeNightsResult.hasNightFlight}
          />
        </div>
      )}

      {/* PREFERRED AIRLINE: Add Nights Result */}
      {usePreferredAirline && selectedAirlines.length > 0 && preferredAirlineResults.addNights && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-blue-500" />
            <div>
              <h3 className="font-semibold text-foreground">
                {preferredAirlineResults.addNights.recommendReason} {Math.abs(preferredAirlineResults.addNights.nightsDiff || 0)} {t.extraNights}
              </h3>
              <p className="text-xs text-muted-foreground">
                Lengre opphold (+{Math.abs(preferredAirlineResults.addNights.nightsDiff || 0)} netter)
              </p>
            </div>
          </div>
          <FlightResultCard
            flight={preferredAirlineResults.addNights}
            language={language}
            translations={t}
            formatTime={formatTime}
            formatDate={formatDate}
            formatDuration={formatDuration}
            onSave={saveToPowerPointSingle}
            title={preferredAirlineResults.addNights.recommendReason || t.cheaperExtended}
            childrenCount={parseInt(children)}
            hasNightFlight={preferredAirlineResults.addNights.hasNightFlight}
          />
        </div>
      )}

      {/* PREFERRED AIRLINE: Remove Nights Result */}
      {usePreferredAirline && selectedAirlines.length > 0 && preferredAirlineResults.removeNights && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-blue-500" />
            <div>
              <h3 className="font-semibold text-foreground">
                {preferredAirlineResults.removeNights.recommendReason} {Math.abs(preferredAirlineResults.removeNights.nightsDiff || 0)} {t.fewerNights}
              </h3>
              <p className="text-xs text-muted-foreground">
                Kortere opphold (-{Math.abs(preferredAirlineResults.removeNights.nightsDiff || 0)} netter)
              </p>
            </div>
          </div>
          <FlightResultCard
            flight={preferredAirlineResults.removeNights}
            language={language}
            translations={t}
            formatTime={formatTime}
            formatDate={formatDate}
            formatDuration={formatDuration}
            onSave={saveToPowerPointSingle}
            title={preferredAirlineResults.removeNights.recommendReason || t.cheaperExtended}
            childrenCount={parseInt(children)}
            hasNightFlight={preferredAirlineResults.removeNights.hasNightFlight}
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
            childrenCount={parseInt(children)}
            hasNightFlight={dateIntervalResult.hasNightFlight}
          />
        </div>
      )}

      {/* PREFERRED AIRLINE: Date Interval Result */}
      {usePreferredAirline && selectedAirlines.length > 0 && preferredAirlineResults.dateInterval && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-blue-500" />
            <div>
              <h3 className="font-semibold text-foreground">
                {preferredAirlineResults.dateInterval.recommendReason}
              </h3>
              {preferredAirlineResults.dateInterval.searchDate && (
                <p className="text-xs text-muted-foreground">
                  Avreise: {format(new Date(preferredAirlineResults.dateInterval.searchDate), "dd.MM.yyyy")}
                </p>
              )}
            </div>
          </div>
          <FlightResultCard
            flight={preferredAirlineResults.dateInterval}
            language={language}
            translations={t}
            formatTime={formatTime}
            formatDate={formatDate}
            formatDuration={formatDuration}
            onSave={saveToPowerPointSingle}
            title={preferredAirlineResults.dateInterval.recommendReason || t.searchInInterval}
            childrenCount={parseInt(children)}
            hasNightFlight={preferredAirlineResults.dateInterval.hasNightFlight}
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
                    {noMainResultsCriteria}
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
