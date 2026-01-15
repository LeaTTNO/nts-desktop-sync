import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plane, Copy, Check, Clock, ArrowRight, Users, Timer, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { FlightOffer, airportNames } from "@/lib/amadeusClient";

interface FlightLeg {
  departure: string;
  arrival: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  airlines: string[];
  segments: string;
}

interface ProcessedFlight {
  id: string;
  outbound: FlightLeg;
  inbound?: FlightLeg;
  price: number;
  currency: string;
  isRecommended: boolean;
  recommendReason?: string;
  rawOffer?: FlightOffer;
}

interface FlightResultCardProps {
  flight: ProcessedFlight;
  language: string;
  translations: {
    outbound: string;
    inbound: string;
    stops: string;
    stopsPlural: string;
    direct: string;
    price: string;
    perPerson: string;
    copy: string;
    copied: string;
    duration: string;
    recommended: string;
    showDetails: string;
    hideDetails: string;
  };
  formatTime: (iso: string) => string;
  formatDate: (iso: string) => string;
  formatDuration: (iso: string) => string;
}

export default function FlightResultCard({
  flight,
  language,
  translations: t,
  formatTime,
  formatDate,
  formatDuration,
}: FlightResultCardProps) {
  const [copied, setCopied] = useState(false);
  const [showOutboundDetails, setShowOutboundDetails] = useState(false);
  const [showInboundDetails, setShowInboundDetails] = useState(false);

  const seatsText = language === "da" ? "ledige" : "ledige";
  const layoverText = language === "da" ? "ventetid" : "ventetid";

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat(language === "da" ? "da-DK" : "nb-NO", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getStopsText = (stops: number) => {
    if (stops === 0) return t.direct;
    return `${stops} ${stops === 1 ? t.stops : t.stopsPlural}`;
  };

  // Calculate layover durations for an itinerary - returns full segment data
  const getLayoverData = (itineraryIndex: number): Array<{airport: string, city: string, arrivalTime: string, departureTime: string, duration: string, arrivalDate: string, departureDate: string}> => {
    if (!flight.rawOffer?.itineraries?.[itineraryIndex]) return [];
    
    const segments = flight.rawOffer.itineraries[itineraryIndex].segments;
    const layovers: Array<{airport: string, city: string, arrivalTime: string, departureTime: string, duration: string, arrivalDate: string, departureDate: string}> = [];
    
    for (let i = 0; i < segments.length - 1; i++) {
      const arrivalTime = new Date(segments[i].arrival.at);
      const nextDepartureTime = new Date(segments[i + 1].departure.at);
      const diffMs = nextDepartureTime.getTime() - arrivalTime.getTime();
      const diffMins = Math.round(diffMs / (1000 * 60));
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      
      const airport = segments[i].arrival.iataCode;
      const city = airportNames[airport] || airport;
      
      layovers.push({
        airport,
        city,
        arrivalTime: formatTime(segments[i].arrival.at),
        departureTime: formatTime(segments[i + 1].departure.at),
        duration: `${hours}t ${mins}m`,
        arrivalDate: formatDate(segments[i].arrival.at),
        departureDate: formatDate(segments[i + 1].departure.at)
      });
    }
    
    return layovers;
  };

  const outboundLayovers = getLayoverData(0);
  const inboundLayovers = getLayoverData(1);
  const availableSeats = flight.rawOffer?.numberOfBookableSeats;

  const copyToClipboard = () => {
    const outboundText = `${t.outbound}: ${flight.outbound.departure} → ${flight.outbound.arrival} | ${formatDate(flight.outbound.departureTime)} ${formatTime(flight.outbound.departureTime)} - ${formatTime(flight.outbound.arrivalTime)} | ${flight.outbound.airlines.join(", ")} | ${getStopsText(flight.outbound.stops)}`;
    
    let text = outboundText;
    
    if (outboundLayovers.length > 0) {
      const layoverTexts = outboundLayovers.map(l => `${l.airport} (${l.city}): ${l.arrivalTime}–${l.departureTime} (${l.duration})`);
      text += ` | ${layoverText}: ${layoverTexts.join(", ")}`;
    }
    
    if (flight.inbound) {
      const inboundText = `${t.inbound}: ${flight.inbound.departure} → ${flight.inbound.arrival} | ${formatDate(flight.inbound.departureTime)} ${formatTime(flight.inbound.departureTime)} - ${formatTime(flight.inbound.arrivalTime)} | ${flight.inbound.airlines.join(", ")} | ${getStopsText(flight.inbound.stops)}`;
      text += `\n${inboundText}`;
      
      if (inboundLayovers.length > 0) {
        const layoverTexts = inboundLayovers.map(l => `${l.airport} (${l.city}): ${l.arrivalTime}–${l.departureTime} (${l.duration})`);
        text += ` | ${layoverText}: ${layoverTexts.join(", ")}`;
      }
    }
    
    text += `\n${t.price}: ${formatPrice(flight.price, flight.currency)} ${t.perPerson}`;
    
    if (availableSeats) {
      text += ` (${availableSeats} ${seatsText})`;
    }
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(t.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderLeg = (leg: FlightLeg, label: string, layovers: Array<{airport: string, city: string, arrivalTime: string, departureTime: string, duration: string, arrivalDate: string, departureDate: string}>, isExpanded: boolean, toggleExpanded: () => void) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-primary uppercase tracking-wider">
          {label}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDate(leg.departureTime)}
        </span>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Departure */}
        <div className="text-center min-w-[60px]">
          <div className="text-lg font-bold">{formatTime(leg.departureTime)}</div>
          <div className="text-sm font-medium">{leg.departure}</div>
        </div>

        {/* Flight Path */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(leg.duration)}
          </div>
          <div className="w-full flex items-center gap-1">
            <div className="h-px flex-1 bg-border" />
            <Plane className="h-3 w-3 text-primary" />
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="text-xs text-muted-foreground">
            {getStopsText(leg.stops)}
          </div>
        </div>

        {/* Arrival */}
        <div className="text-center min-w-[60px]">
          <div className="text-lg font-bold">{formatTime(leg.arrivalTime)}</div>
          <div className="text-sm font-medium">{leg.arrival}</div>
        </div>
      </div>

      {/* Airlines - always show */}
      <div className="text-xs text-muted-foreground">
        {leg.airlines.join(" · ")}
      </div>

      {/* Toggle details button - only show if there are layovers */}
      {layovers.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleExpanded}
          className="w-full text-xs h-7 gap-1"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              {t.hideDetails}
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              {t.showDetails}
            </>
          )}
        </Button>
      )}

      {/* Expanded details - segments and layovers */}
      {isExpanded && layovers.length > 0 && (
        <div className="pt-3 pb-2 space-y-2 border-t border-border/30">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            Flysegmenter: {leg.segments}
          </div>
          <div className="space-y-3">
            {layovers.map((layover, idx) => {
              return (
                <div 
                  key={idx}
                  className="px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-7 h-7 bg-amber-500 rounded-full flex-shrink-0 mt-0.5">
                      <Timer className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="font-semibold text-amber-900 dark:text-amber-100">
                        {layover.airport} - {layover.city}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-amber-700 dark:text-amber-400 font-medium">Landing: </span>
                          <span className="text-amber-900 dark:text-amber-200">{layover.arrivalDate} {layover.arrivalTime}</span>
                        </div>
                        <div>
                          <span className="text-amber-700 dark:text-amber-400 font-medium">Avgang: </span>
                          <span className="text-amber-900 dark:text-amber-200">{layover.departureDate} {layover.departureTime}</span>
                        </div>
                      </div>
                      <div className="text-xs">
                        <span className="text-amber-700 dark:text-amber-400 font-medium">Ventetid: </span>
                        <span className="text-amber-900 dark:text-amber-200 font-semibold">{layover.duration}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Card className={`border-border/50 ${flight.isRecommended ? "ring-2 ring-primary/30" : ""}`}>
      <CardContent className="pt-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Flight Details */}
          <div className="flex-1 space-y-6">
            {/* Recommended Badge */}
            {flight.isRecommended && (
              <Badge variant="default" className="bg-primary/10 text-primary border-primary/20">
                ⭐ {flight.recommendReason || t.recommended}
              </Badge>
            )}

            {/* Outbound */}
            {renderLeg(flight.outbound, t.outbound, outboundLayovers, showOutboundDetails, () => setShowOutboundDetails(!showOutboundDetails))}

            {/* Inbound */}
            {flight.inbound && (
              <>
                <div className="border-t border-border/50" />
                {renderLeg(flight.inbound, t.inbound, inboundLayovers, showInboundDetails, () => setShowInboundDetails(!showInboundDetails))}
              </>
            )}
          </div>

          {/* Price & Actions */}
          <div className="lg:border-l lg:pl-6 lg:min-w-[180px] flex flex-col justify-between">
            <div className="text-center lg:text-right">
              <div className="text-2xl font-bold text-primary">
                {formatPrice(flight.price, flight.currency)}
              </div>
              <div className="text-xs text-muted-foreground">
                {t.perPerson}
              </div>
              
              {/* Available seats */}
              {availableSeats && (
                <div className="flex items-center justify-center lg:justify-end gap-1 mt-2 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>{availableSeats} {seatsText}</span>
                </div>
              )}
            </div>

            <Button 
              variant="outline" 
              size="sm"
              onClick={copyToClipboard}
              className="mt-4 w-full lg:w-auto"
            >
              {copied ? (
                <>
                  <Check className="mr-1 h-3 w-3" />
                  {t.copied}
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3 w-3" />
                  {t.copy}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
