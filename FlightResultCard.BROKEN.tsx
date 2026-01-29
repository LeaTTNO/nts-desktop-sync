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


// Bruk hele oversettelsesobjektet og formatteringsfunksjoner fra FlightRobot
interface FlightResultCardProps {
  flight: ProcessedFlight;
  language: string;
  translations: any; // Hele oversettelsesobjektet fra FlightRobot
  formatTime: (iso: string) => string;
  formatDate: (iso: string) => string;
  formatDuration: (iso: string) => string;
}

export default function FlightResultCard({
  flight,
  language,
  translations,
  formatTime,
  formatDate,
  formatDuration,
  hasFlightSlide,
  isSelected,
}: FlightResultCardProps & { hasFlightSlide?: boolean; isSelected?: boolean }) {
  // Bruker t for konsistens videre
  const t = translations;
  const [copied, setCopied] = useState(false);
  const [showOutboundDetails, setShowOutboundDetails] = useState(false);
  const [showInboundDetails, setShowInboundDetails] = useState(false);

  // Hent tekst fra oversettelser hvis mulig
  const seatsText = t.seats || (language === "da" ? "ledige" : "ledige");
  const layoverText = t.layover || (language === "da" ? "ventetid" : "ventetid");

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
      return (
        <Card className={`border-border/50 ${flight.isRecommended ? "ring-2 ring-primary/30" : ""} ${isSelected ? "ring-2 ring-green-500/40" : ""}`}>
          <CardContent className="pt-6">
            {/* Selected flight marker (UX B) */}
            {isSelected && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-600"><Check className="inline-block h-4 w-4" /></span>
                <span className="text-xs font-semibold text-green-700">
                  {language === "da" ? "Valgt fly" : "Valgt flight"}
                </span>
              </div>
            return (
              <>
                <div className="flex flex-col md:flex-row gap-4 items-center md:items-stretch">
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

                {/* Expanded details - segments og layovers */}
                {isExpanded && (
                  <div className="pt-3 pb-2 space-y-2 border-t border-border/30">
                    {/* Flysegmenter */}
                    {flight.rawOffer?.itineraries && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground mb-2">Flysegmenter:</div>
                        {flight.rawOffer.itineraries[label === t.outbound ? 0 : 1]?.segments.map((seg, idx) => (
                          <div key={idx} className="px-4 py-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30 rounded-md mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-blue-900 dark:text-blue-100">{seg.departure.iataCode}</span>
                              <span className="text-xs text-muted-foreground">{formatDate(seg.departure.at)} {formatTime(seg.departure.at)}</span>
                              <ArrowRight className="h-3 w-3 mx-1 text-muted-foreground" />
                              <span className="font-semibold text-blue-900 dark:text-blue-100">{seg.arrival.iataCode}</span>
                              <span className="text-xs text-muted-foreground">{formatDate(seg.arrival.at)} {formatTime(seg.arrival.at)}</span>
                              <span className="ml-2 text-xs text-muted-foreground">{seg.carrierCode}{seg.number}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Mellomlandinger */}
                    {layovers.length > 0 && (
                      <div className="space-y-3 mt-2">
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
                    )}
                  </div>
                )}
              </>
            );
              {t.showDetails}
            </>
          )}
        </Button>
      )}

      {/* Expanded details - segments og layovers */}
      {isExpanded && (
        <div className="pt-3 pb-2 space-y-2 border-t border-border/30">
          {/* Flysegmenter */}
          {flight.rawOffer?.itineraries && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground mb-2">Flysegmenter:</div>
              {flight.rawOffer.itineraries[label === t.outbound ? 0 : 1]?.segments.map((seg, idx) => (
                <div key={idx} className="px-4 py-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30 rounded-md mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-blue-900 dark:text-blue-100">{seg.departure.iataCode}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(seg.departure.at)} {formatTime(seg.departure.at)}</span>
                    <ArrowRight className="h-3 w-3 mx-1 text-muted-foreground" />
                    <span className="font-semibold text-blue-900 dark:text-blue-100">{seg.arrival.iataCode}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(seg.arrival.at)} {formatTime(seg.arrival.at)}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{seg.carrierCode}{seg.number}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Mellomlandinger */}
          {layovers.length > 0 && (
            <div className="space-y-3 mt-2">
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
          )}
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

            <div className="mt-4 flex flex-col gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => t.onSendToPowerPoint?.(flight)}
              >
                {t.sendToPowerPoint}
              </Button>

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
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
