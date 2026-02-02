import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plane, Copy, Check, Clock, ArrowRight, Users, Timer, ChevronDown, ChevronUp, FileDown } from "lucide-react";
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
  onSave?: (flight: ProcessedFlight, title: string) => void;
  title?: string;
  childrenCount?: number;
}

export default function FlightResultCard({
  flight,
  language,
  translations: t,
  formatTime,
  formatDate,
  formatDuration,
  onSave,
  title = "",
  childrenCount = 0,
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
    // Detaljert tabell med alle flysegmenter - fast kolonnestørrelse
    const airline = flight.outbound.airlines[0] || "Flyreise";
    
    // Rund opp til nærmeste 50 kr
    const roundedPrice = Math.ceil(flight.price / 50) * 50;
    
    let text = `${airline}\n`;
    text += `${'─'.repeat(90)}\n`;
    
    // Funksjon for å hente alle segmenter fra rawOffer
    const getSegments = (itineraryIndex: number) => {
      if (!flight.rawOffer?.itineraries?.[itineraryIndex]) return [];
      return flight.rawOffer.itineraries[itineraryIndex].segments;
    };
    
    const outboundSegments = getSegments(0);
    const inboundSegments = getSegments(1);
    
    // UTREISE - alle segmenter med fast kolonnebredde
    if (outboundSegments.length > 0) {
      outboundSegments.forEach((seg) => {
        const fromCity = airportNames[seg.departure.iataCode] || seg.departure.iataCode;
        const toCity = airportNames[seg.arrival.iataCode] || seg.arrival.iataCode;
        const date = formatDate(seg.departure.at);
        const depTime = formatTime(seg.departure.at);
        const arrTime = formatTime(seg.arrival.at);
        
        // Sjekk om ankomst er neste dag
        const depDate = new Date(seg.departure.at);
        const arrDate = new Date(seg.arrival.at);
        const nextDay = arrDate.getDate() !== depDate.getDate() ? '+1' : '';
        
        // Fast kolonnebredde: Flyselskap(20) Dato(15) Fra(20) -(5) Til(20) Tider
        const airlineCol = airline.padEnd(20, ' ');
        const dateCol = date.padEnd(15, ' ');
        const fromCol = fromCity.padEnd(20, ' ');
        const separator = '  -  '; // 5 tegn
        const toCol = toCity.padEnd(20, ' ');
        const times = `${depTime} - ${arrTime}${nextDay}`;
        
        text += `${airlineCol}${dateCol}${fromCol}${separator}${toCol}${times}\n`;
      });
    }
    
    // HJEMREISE - alle segmenter med fast kolonnebredde
    if (inboundSegments.length > 0) {
      inboundSegments.forEach((seg) => {
        const fromCity = airportNames[seg.departure.iataCode] || seg.departure.iataCode;
        const toCity = airportNames[seg.arrival.iataCode] || seg.arrival.iataCode;
        const date = formatDate(seg.departure.at);
        const depTime = formatTime(seg.departure.at);
        const arrTime = formatTime(seg.arrival.at);
        
        // Sjekk om ankomst er neste dag
        const depDate = new Date(seg.departure.at);
        const arrDate = new Date(seg.arrival.at);
        const nextDay = arrDate.getDate() !== depDate.getDate() ? '+1' : '';
        
        // Fast kolonnebredde: Flyselskap(20) Dato(15) Fra(20) -(5) Til(20) Tider
        const airlineCol = airline.padEnd(20, ' ');
        const dateCol = date.padEnd(15, ' ');
        const fromCol = fromCity.padEnd(20, ' ');
        const separator = '  -  '; // 5 tegn
        const toCol = toCity.padEnd(20, ' ');
        const times = `${depTime} - ${arrTime}${nextDay}`;
        
        text += `${airlineCol}${dateCol}${fromCol}${separator}${toCol}${times}\n`;
      });
    }
    
    text += `${'─'.repeat(90)}\n`;
    
    // Pris med avrunding og fast tekst
    if (language === "no") {
      text += `Pris: kr ${roundedPrice.toLocaleString('nb-NO')} per person +innenriksflyene og 800 kr i utstedelsesgebyr`;
      
      // Barnepris (75% av voksenpris)
      if (childrenCount > 0) {
        const childPrice = Math.ceil((flight.price * 0.75) / 50) * 50;
        text += `\nBarnepris (${childrenCount} barn): kr ${childPrice.toLocaleString('nb-NO')} per barn`;
      }
    } else {
      text += `Pris: kr ${roundedPrice.toLocaleString('da-DK')} per person +indenrigsfly og 500 kr i udstedelsesgebyr`;
      
      // Barnepris (75% av voksenpris)
      if (childrenCount > 0) {
        const childPrice = Math.ceil((flight.price * 0.75) / 50) * 50;
        text += `\nBørnepris (${childrenCount} børn): kr ${childPrice.toLocaleString('da-DK')} per barn`;
      }
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
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Mellomlandinger
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {layovers.map((layover, idx) => {
              return (
                <div 
                  key={idx}
                  className="p-3 bg-gradient-to-br from-muted/30 to-muted/50 border border-border/40 rounded-lg hover:border-primary/30 transition-colors"
                >
                  {/* Header med nummer og by */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center justify-center w-6 h-6 bg-primary text-primary-foreground rounded-full text-xs font-bold flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="font-semibold text-sm text-foreground">
                      {layover.city}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ({layover.airport})
                    </div>
                  </div>

                  {/* Tider i grid */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Landing:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{layover.arrivalTime}</span>
                        <span className="text-[10px] text-muted-foreground">{layover.arrivalDate}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Avgang:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{layover.departureTime}</span>
                        <span className="text-[10px] text-muted-foreground">{layover.departureDate}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-border/30">
                      <div className="flex items-center gap-1">
                        <Timer className="h-3 w-3 text-primary" />
                        <span className="text-muted-foreground">Ventetid:</span>
                      </div>
                      <span className="font-bold text-primary">{layover.duration}</span>
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
     <Card className="w-full overflow-hidden border-border/50">
      <CardContent className="pt-6">
        <div className="flex flex-col lg:flex-row items-start gap-6">
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
              
              {/* Child price */}
              {childrenCount > 0 && (
                <div className="mt-2">
                  <div className="text-lg font-semibold text-foreground">
                    {formatPrice(flight.price * 0.75, flight.currency)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {language === "no" ? `per barn (${childrenCount})` : `per barn (${childrenCount})`}
                  </div>
                </div>
              )}
              
              {/* Available seats */}
              {availableSeats && (
                <div className="flex items-center justify-center lg:justify-end gap-1 mt-2 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>{availableSeats} {seatsText}</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2 w-full lg:w-auto">
              <Button 
                variant="outline" 
                size="sm"
                onClick={copyToClipboard}
                className="w-full"
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
              {onSave && (
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => onSave(flight, title)}
                  className="w-full"
                >
                  <FileDown className="mr-1 h-3 w-3" />
                  {language === "no" ? "Send til PowerPoint" : "Send til PowerPoint"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
