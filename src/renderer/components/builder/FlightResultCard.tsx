import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Users, ChevronDown, FileDown } from "lucide-react";
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
  fareType?: "NEGOTIATED" | "PUBLIC";
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
  };
  formatTime: (iso: string) => string;
  formatDate: (iso: string) => string;
  formatDuration: (iso: string) => string;
  onSave?: (flight: ProcessedFlight, title: string) => void;
  onSendToPowerPoint?: (flight: ProcessedFlight) => void;
  title?: string;
  childrenCount?: number;
  hasNightFlight?: boolean;
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
  hasNightFlight = false,
}: FlightResultCardProps) {
  const [copied, setCopied] = useState(false);
  const [showOutboundDetails, setShowOutboundDetails] = useState(false);
  const [showInboundDetails, setShowInboundDetails] = useState(false);

  const seatsText = language === "da" ? "ledige" : "ledige";
  const layoverText = language === "da" ? "ventetid" : "ventetid";

  // Get fare type info for the indicator
  const getFareTypeInfo = () => {
    if (flight.fareType === "NEGOTIATED") {
      return { color: "#ef4444", label: "Pakkepris" };
    } else if (flight.fareType === "PUBLIC") {
      return { color: "#3b82f6", label: "Skjermpris" };
    }
    return null;
  };
  const fareTypeInfo = getFareTypeInfo();

  const formatPrice = (price: number, currency: string) => {
    const formattedNumber = Math.round(price).toLocaleString(language === "da" ? "da-DK" : "nb-NO");
    return `${formattedNumber} ${currency}`;
  };

  // Calculate layover durations for an itinerary
  const getLayoverData = (itineraryIndex: number): Array<{
    airport: string;
    city: string;
    arrivalTime: string;
    departureTime: string;
    duration: string;
    arrivalDate: string;
    departureDate: string;
  }> => {
    if (!flight.rawOffer?.itineraries?.[itineraryIndex]) return [];
    
    const segments = flight.rawOffer.itineraries[itineraryIndex].segments;
    const layovers: Array<{
      airport: string;
      city: string;
      arrivalTime: string;
      departureTime: string;
      duration: string;
      arrivalDate: string;
      departureDate: string;
    }> = [];
    
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

  const copyToClipboard = async () => {
    const airline = flight.outbound.airlines[0] || "Flyreise";
    const roundedPrice = Math.ceil(flight.price / 50) * 50;
    
    const formatShortDate = (isoDateTime: string): string => {
      const date = new Date(isoDateTime);
      const day = String(date.getDate()).padStart(2, '0');
      const monthShort = date.toLocaleDateString(language === 'da' ? 'da-DK' : 'nb-NO', { month: 'short' });
      return `${day}.${monthShort}`;
    };
    
    const getSegments = (itineraryIndex: number) => {
      if (!flight.rawOffer?.itineraries?.[itineraryIndex]) return [];
      return flight.rawOffer.itineraries[itineraryIndex].segments;
    };
    
    const outboundSegments = getSegments(0);
    const inboundSegments = getSegments(1);
    
    let htmlTable = `<table style="border-collapse: collapse; font-family: Arial, sans-serif;">
  <thead>
    <tr style="background: #f5f5f5;">
      <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Flyselskap</th>
      <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Dato</th>
      <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Rute</th>
      <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Tid</th>
    </tr>
  </thead>
  <tbody>`;
    
    if (outboundSegments.length > 0) {
      outboundSegments.forEach((seg) => {
        const fromCity = airportNames[seg.departure.iataCode] || seg.departure.iataCode;
        const toCity = airportNames[seg.arrival.iataCode] || seg.arrival.iataCode;
        const date = formatShortDate(seg.departure.at);
        const depTime = formatTime(seg.departure.at);
        const arrTime = formatTime(seg.arrival.at);
        
        const depDate = new Date(seg.departure.at);
        const arrDate = new Date(seg.arrival.at);
        const nextDay = arrDate.getDate() !== depDate.getDate() ? ' +1' : '';
        
        htmlTable += `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${airline}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${date}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${fromCity} → ${toCity}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${depTime} – ${arrTime}${nextDay}</td>
    </tr>`;
      });
    }
    
    if (inboundSegments.length > 0) {
      inboundSegments.forEach((seg) => {
        const fromCity = airportNames[seg.departure.iataCode] || seg.departure.iataCode;
        const toCity = airportNames[seg.arrival.iataCode] || seg.arrival.iataCode;
        const date = formatShortDate(seg.departure.at);
        const depTime = formatTime(seg.departure.at);
        const arrTime = formatTime(seg.arrival.at);
        
        const depDate = new Date(seg.departure.at);
        const arrDate = new Date(seg.arrival.at);
        const nextDay = arrDate.getDate() !== depDate.getDate() ? ' +1' : '';
        
        htmlTable += `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${airline}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${date}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${fromCity} → ${toCity}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${depTime} – ${arrTime}${nextDay}</td>
    </tr>`;
      });
    }
    
    htmlTable += `
  </tbody>
</table>`;
    
    let priceText = '';
    if (language === "no") {
      priceText = `<p style="margin-top: 12px; font-family: Arial, sans-serif;">
<strong>Pris:</strong> kr ${roundedPrice.toLocaleString('nb-NO')} per person<br/>
<em>(Innenriksfly + kr 800 utstedelsesgebyr)</em>
</p>`;
      
      if (childrenCount > 0) {
        const childPrice = Math.ceil((flight.price * 0.75) / 50) * 50;
        priceText += `<p style="font-family: Arial, sans-serif;">
<strong>Barnepris (${childrenCount} barn):</strong> kr ${childPrice.toLocaleString('nb-NO')} per barn
</p>`;
      }
    } else {
      priceText = `<p style="margin-top: 12px; font-family: Arial, sans-serif;">
<strong>Pris:</strong> kr ${roundedPrice.toLocaleString('da-DK')} per person<br/>
<em>(Indenriksfly + kr 500 udstedelsesgebyr)</em>
</p>`;
      
      if (childrenCount > 0) {
        const childPrice = Math.ceil((flight.price * 0.75) / 50) * 50;
        priceText += `<p style="font-family: Arial, sans-serif;">
<strong>Børnepris (${childrenCount} børn):</strong> kr ${childPrice.toLocaleString('da-DK')} per barn
</p>`;
      }
    }
    
    const fullHtml = htmlTable + priceText;
    
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([fullHtml], { type: 'text/html' }),
        })
      ]);
      setCopied(true);
      toast.success(t.copied);
    } catch (err) {
      console.error('Failed to copy HTML:', err);
      toast.error('Kunne ikke kopiere');
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const renderLeg = (
    leg: FlightLeg,
    label: string,
    layovers: Array<{
      airport: string;
      city: string;
      arrivalTime: string;
      departureTime: string;
      duration: string;
      arrivalDate: string;
      departureDate: string;
    }>,
    isExpanded: boolean,
    toggleExpanded: () => void,
    itineraryIndex: number
  ) => {
    const getSegments = (idx: number) => {
      if (!flight.rawOffer?.itineraries?.[idx]) return [];
      return flight.rawOffer.itineraries[idx].segments;
    };

    const segments = getSegments(itineraryIndex);
    const hasLayovers = layovers.length > 0;
    const connectionCities = layovers.map(l => l.city);

    const getTotalDuration = (): string => {
      if (!flight.rawOffer?.itineraries?.[itineraryIndex]) return formatDuration(leg.duration);
      const duration = flight.rawOffer.itineraries[itineraryIndex].duration;
      const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
      if (!match) return formatDuration(leg.duration);
      const hours = match[1] ? parseInt(match[1]) : 0;
      const mins = match[2] ? parseInt(match[2]) : 0;
      return `${hours}t ${mins.toString().padStart(2, "0")}m`;
    };

    const departureCity = airportNames[leg.departure] || leg.departure;
    const arrivalCity = airportNames[leg.arrival] || leg.arrival;

    return (
      <div className="border-b border-border/50 last:border-b-0">
        {/* Summary row */}
        <div className="flex items-center py-3 gap-1 ml-[40px]">
          {/* Route - no IATA codes */}
          <div className="flex items-center gap-2 w-[180px] flex-shrink-0">
            <div className="w-2 h-2 rounded-full border-2 border-primary flex-shrink-0" />
            <span className="text-sm font-medium text-foreground">
              {departureCity} → {arrivalCity}
            </span>
          </div>

          {/* Departure time */}
          <div className="text-center w-[60px] flex-shrink-0">
            <div className="text-base font-semibold text-foreground">{formatTime(leg.departureTime)}</div>
            <div className="text-[10px] text-muted-foreground">{formatDate(leg.departureTime)}</div>
          </div>

          {/* Connection info - wider for 2 stopovers */}
          <div className="flex flex-col items-center w-[140px] flex-shrink-0">
            {hasLayovers ? (
              <>
                <div className="flex items-center justify-center gap-1 text-xs font-medium text-foreground whitespace-nowrap">
                  {connectionCities.join(" · ")}
                </div>
                <div className="w-full h-px bg-border my-0.5" />
                <div className="text-[10px] text-muted-foreground">{getTotalDuration()}</div>
              </>
            ) : (
              <>
                <span className="text-[10px] text-muted-foreground">{t.direct}</span>
                <div className="w-16 h-px bg-border my-0.5" />
                <div className="text-[10px] text-muted-foreground">{getTotalDuration()}</div>
              </>
            )}
          </div>

          {/* Arrival time */}
          <div className="text-center w-[60px] flex-shrink-0">
            <div className="text-base font-semibold text-foreground">{formatTime(leg.arrivalTime)}</div>
            <div className="text-[10px] text-muted-foreground">{formatDate(leg.arrivalTime)}</div>
          </div>
        </div>

        {/* Expanded segment details */}
        {isExpanded && segments.length > 0 && (
          <div className="bg-muted/30 border-t border-border/30 py-2 ml-[40px]">
            {segments.map((seg, idx) => {
              const fromCode = seg.departure.iataCode;
              const toCode = seg.arrival.iataCode;
              const fromCity = airportNames[fromCode] || fromCode;
              const toCity = airportNames[toCode] || toCode;
              const depTime = formatTime(seg.departure.at);
              const arrTime = formatTime(seg.arrival.at);
              const depDate = formatDate(seg.departure.at);
              const arrDate = formatDate(seg.arrival.at);

              return (
                <React.Fragment key={idx}>
                  <div className="flex items-center text-xs py-1">
                    {/* Route - narrower */}
                    <div className="text-foreground pl-5 w-[180px] flex-shrink-0">
                      {fromCity} — {toCity}
                    </div>
                    
                    {/* Spacer to push times right - aligns under connection column */}
                    <div className="w-[60px] flex-shrink-0" />
                    
                    {/* Times - compact, positioned under connection column */}
                    <div className="flex items-center gap-3 w-[140px] justify-center flex-shrink-0">
                      <div className="text-center">
                        <div className="font-medium text-foreground">{depTime}</div>
                        <div className="text-[10px] text-muted-foreground">{depDate}</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-foreground">{arrTime}</div>
                        <div className="text-[10px] text-muted-foreground">{arrDate}</div>
                      </div>
                    </div>
                  </div>
                  
                  {idx < layovers.length && layovers[idx] && (
                    <div className="text-[10px] text-muted-foreground pl-5 py-0.5">
                      ⏱ {layoverText}: {layovers[idx].duration} i {layovers[idx].city}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Show/hide details button */}
        {hasLayovers && (
          <button 
            onClick={toggleExpanded} 
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground py-1.5 pl-5 cursor-pointer transition-colors"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
            {isExpanded ? "Skjul detaljer" : "Vis detaljer"}
          </button>
        )}
      </div>
    );
  };

  return (
    <Card className="relative overflow-hidden border-l-4" style={{ 
      borderLeftColor: flight.fareType === "NEGOTIATED" ? "#ef4444" : flight.fareType === "PUBLIC" ? "#3b82f6" : "transparent" 
    }}>
      
      {/* Airline header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-foreground">{flight.outbound.airlines[0]}</span>
          {flight.isRecommended && (
            <Badge variant="default" className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0">
              ⭐ {flight.recommendReason || t.recommended}
            </Badge>
          )}
          {hasNightFlight && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px] px-1.5 py-0">
              ⚠️ {language === "no" ? "Nattfly" : "Natfly"}
            </Badge>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">AMADEUS</span>
      </div>

      <CardContent className="p-3">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Flight legs */}
          <div className="flex-1">
            {renderLeg(flight.outbound, t.outbound, outboundLayovers, showOutboundDetails, () => setShowOutboundDetails(!showOutboundDetails), 0)}
            {flight.inbound && renderLeg(flight.inbound, t.inbound, inboundLayovers, showInboundDetails, () => setShowInboundDetails(!showInboundDetails), 1)}
          </div>

          {/* Price & Actions - compact */}
          <div className="lg:border-l lg:pl-3 lg:min-w-[120px] flex flex-col justify-center">
            <div className="text-center lg:text-right">
              {/* Fare type indicator */}
              {fareTypeInfo && (
                <div className="flex items-center justify-center lg:justify-end gap-1 mb-1">
                  <div 
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: fareTypeInfo.color }} 
                  />
                  <span className="text-[10px] text-muted-foreground">{fareTypeInfo.label}</span>
                </div>
              )}
              
              <div className="text-xl font-bold text-primary">
                {formatPrice(flight.price, flight.currency)}
              </div>
              <div className="text-[10px] text-muted-foreground">{t.perPerson}</div>

              {childrenCount > 0 && (
                <div className="mt-0.5">
                  <div className="text-base font-semibold text-primary/80">
                    {formatPrice(flight.price * 0.75, flight.currency)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    per barn ({childrenCount})
                  </div>
                </div>
              )}

              {availableSeats && (
                <div className="flex items-center justify-center lg:justify-end gap-1 mt-0.5 text-[10px] text-muted-foreground">
                  <Users className="h-2.5 w-2.5" />
                  <span>{availableSeats} {seatsText}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5 mt-2">
              <Button variant="outline" size="sm" onClick={copyToClipboard} className="w-full h-7 text-xs px-2">
                {copied ? (
                  <>
                    <Check className="h-3 w-3" />
                    {t.copied}
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    {t.copy}
                  </>
                )}
              </Button>

              {onSave && (
                <Button variant="default" size="sm" onClick={() => onSave(flight, title)} className="w-full h-7 text-xs px-2">
                  <FileDown className="h-3 w-3" />
                  PPTX
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
