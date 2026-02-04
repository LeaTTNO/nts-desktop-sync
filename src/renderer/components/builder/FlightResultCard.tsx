import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plane, Copy, Check, Clock, ArrowRight, Users, Timer, ChevronDown, ChevronUp, FileDown } from "lucide-react";
import { toast } from "sonner";
import { FlightOffer, airportNames } from "@/lib/flightRobotClient";

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

  const formatPrice = (price: number, currency: string) => {
    const formattedNumber = Math.round(price).toLocaleString(language === "da" ? "da-DK" : "nb-NO");
    return `${formattedNumber} ${currency}`;
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
    
    // Build HTML table
    let htmlTable = `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px;">
  <thead>
    <tr style="background-color: #f0f0f0;">
      <th style="text-align: left; padding: 8px;">Flyselskap</th>
      <th style="text-align: left; padding: 8px;">Dato</th>
      <th style="text-align: left; padding: 8px;">Rute</th>
      <th style="text-align: left; padding: 8px;">Tid</th>
    </tr>
  </thead>
  <tbody>`;
    
    // UTREISE - Each segment as a row
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
      <td style="padding: 6px;">${airline}</td>
      <td style="padding: 6px;">${date}</td>
      <td style="padding: 6px;">${fromCity} → ${toCity}</td>
      <td style="padding: 6px;">${depTime} – ${arrTime}${nextDay}</td>
    </tr>`;
      });
    }
    
    // HJEMREISE - Each segment as a row
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
      <td style="padding: 6px;">${airline}</td>
      <td style="padding: 6px;">${date}</td>
      <td style="padding: 6px;">${fromCity} → ${toCity}</td>
      <td style="padding: 6px;">${depTime} – ${arrTime}${nextDay}</td>
    </tr>`;
      });
    }
    
    htmlTable += `
  </tbody>
</table>`;
    
    // Add price below table
    let priceText = '';
    if (language === "no") {
      priceText = `<p style="margin-top: 16px; font-family: Arial, sans-serif; font-size: 12px;">Pris: kr ${roundedPrice.toLocaleString('nb-NO')} per person<br>(Innenriksfly + kr 800 utstedelsesgebyr)</p>`;
      
      if (childrenCount > 0) {
        const childPrice = Math.ceil((flight.price * 0.75) / 50) * 50;
        priceText += `<p style="font-family: Arial, sans-serif; font-size: 12px;">Barnepris (${childrenCount} barn): kr ${childPrice.toLocaleString('nb-NO')} per barn</p>`;
      }
    } else {
      priceText = `<p style="margin-top: 16px; font-family: Arial, sans-serif; font-size: 12px;">Pris: kr ${roundedPrice.toLocaleString('da-DK')} per person<br>(Indenrigsfly + kr 500 udstedelsesgebyr)</p>`;
      
      if (childrenCount > 0) {
        const childPrice = Math.ceil((flight.price * 0.75) / 50) * 50;
        priceText += `<p style="font-family: Arial, sans-serif; font-size: 12px;">Børnepris (${childrenCount} børn): kr ${childPrice.toLocaleString('da-DK')} per barn</p>`;
      }
    }
    
    const fullHtml = htmlTable + priceText;
    
    // Copy as HTML to clipboard
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

  const renderLeg = (leg: FlightLeg, label: string, layovers: Array<{airport: string, city: string, arrivalTime: string, departureTime: string, duration: string, arrivalDate: string, departureDate: string}>, isExpanded: boolean, toggleExpanded: () => void, itineraryIndex: number) => {
    const getSegments = (idx: number) => {
      if (!flight.rawOffer?.itineraries?.[idx]) return [];
      return flight.rawOffer.itineraries[idx].segments;
    };

    const segments = getSegments(itineraryIndex);
    const hasLayovers = layovers.length > 0;
    const connectionCities = layovers.map(l => l.city).join(", ");

    return (
      <div className="space-y-3">
        {/* 1️⃣ Flyselskap */}
        <div className="text-lg font-bold text-neutral-900 leading-tight mb-1">{leg.airlines[0]}</div>

        {/* 2️⃣ Rute og tider */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xl font-semibold text-primary">
            <span>{leg.departure}</span>
            <ArrowRight className="h-5 w-5 text-primary" />
            <span>{leg.arrival}</span>
          </div>
          <div className="flex flex-col text-base font-medium text-neutral-800">
            <span>{formatDate(leg.departureTime)} · {formatTime(leg.departureTime)} – {formatTime(leg.arrivalTime)}</span>
            {hasLayovers && (
              <span className="text-sm text-muted-foreground">via {connectionCities}</span>
            )}
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatDuration(leg.duration)}
            </span>
          </div>
        </div>

        {/* 3️⃣ Sekundær: ventetid og segment-detaljer */}
        {hasLayovers && (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleExpanded}
            className="text-xs h-7 gap-1 px-2 -mt-1 text-gray-500"
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

        {isExpanded && segments.length > 0 && (
          <div className="ml-4 pl-3 border-l-2 border-muted/40 space-y-2 pt-1">
            {segments.map((seg, idx) => {
              const fromCode = seg.departure.iataCode;
              const toCode = seg.arrival.iataCode;
              const fromCity = airportNames[fromCode] || fromCode;
              const toCity = airportNames[toCode] || toCode;
              const depTime = formatTime(seg.departure.at);
              const arrTime = formatTime(seg.arrival.at);
              const segDate = formatDate(seg.departure.at);
              const depDate = new Date(seg.departure.at);
              const arrDate = new Date(seg.arrival.at);
              const nextDay = arrDate.getDate() !== depDate.getDate() ? ' (+1)' : '';
              return (
                <div key={idx} className="text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {fromCity} ({fromCode})
                    </span>
                    <span>–</span>
                    <span className="font-medium">
                      {toCity} ({toCode})
                    </span>
                  </div>
                  <div className="text-xs font-normal mt-1">
                    {segDate} · {depTime} – {arrTime}{nextDay}
                  </div>
                  {idx < segments.length - 1 && layovers[idx] && (
                    <div className="flex items-center gap-2 mt-2 text-xs font-normal text-gray-400">
                      <Timer className="h-4 w-4" />
                      <span>
                        {layoverText}: {layovers[idx].arrivalTime} – {layovers[idx].departureTime} ({layovers[idx].duration})
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
     <Card className="w-full overflow-hidden border-border/50">
      <CardContent className="pt-6">
        <div className="flex flex-col lg:flex-row items-start gap-6">
          <div className="flex-1 space-y-6">
            {flight.isRecommended && (
              <Badge variant="default" className="bg-primary/10 text-primary border-primary/20">
                ⭐ {flight.recommendReason || t.recommended}
              </Badge>
            )}
            
            {hasNightFlight && (
              <Badge variant="destructive" className="bg-orange-100 text-orange-800 border-orange-300">
                ⚠️ {language === "no" ? "NB: Avgang/ankomst om natten (00:00-05:55)" : "NB: Afgang/ankomst om natten (00:00-05:55)"}
              </Badge>
            )}

            {renderLeg(flight.outbound, t.outbound, outboundLayovers, showOutboundDetails, () => setShowOutboundDetails(!showOutboundDetails), 0)}

            {flight.inbound && (
              <>
                <div className="border-t border-border/50" />
                {renderLeg(flight.inbound, t.inbound, inboundLayovers, showInboundDetails, () => setShowInboundDetails(!showInboundDetails), 1)}
              </>
            )}
          </div>

          <div className="lg:border-l lg:pl-6 lg:min-w-[180px] flex flex-col justify-between">
            <div className="text-center lg:text-right">
              <div className="text-2xl font-bold text-primary">
                {formatPrice(flight.price, flight.currency)}
              </div>
              <div className="text-xs text-muted-foreground">
                {t.perPerson}
              </div>
              
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
