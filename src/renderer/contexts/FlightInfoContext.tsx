// Context for sharing flight information between FlightRobot and TravelProgramBuilder
import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface FlightInfo {
  id: string;
  title: string;
  price: number;
  currency: string;
  outbound: {
    departure: string;
    arrival: string;
    departureTime: string;
    arrivalTime: string;
    duration: string;
    stops: number;
  };
  inbound?: {
    departure: string;
    arrival: string;
    departureTime: string;
    arrivalTime: string;
    duration: string;
    stops: number;
  };
  passengers: number;
}

interface FlightInfoContextType {
  savedFlights: FlightInfo[];
  addFlight: (flight: FlightInfo) => void;
  removeFlight: (id: string) => void;
  clearFlights: () => void;
}

const FlightInfoContext = createContext<FlightInfoContextType | undefined>(undefined);

export const FlightInfoProvider = ({ children }: { children: ReactNode }) => {
  const [savedFlights, setSavedFlights] = useState<FlightInfo[]>([]);

  const addFlight = (flight: FlightInfo) => {
    setSavedFlights(prev => {
      // Replace if same ID exists
      const filtered = prev.filter(f => f.id !== flight.id);
      return [...filtered, flight];
    });
  };

  const removeFlight = (id: string) => {
    setSavedFlights(prev => prev.filter(f => f.id !== id));
  };

  const clearFlights = () => {
    setSavedFlights([]);
  };

  return (
    <FlightInfoContext.Provider value={{ savedFlights, addFlight, removeFlight, clearFlights }}>
      {children}
    </FlightInfoContext.Provider>
  );
};

export const useFlightInfo = () => {
  const context = useContext(FlightInfoContext);
  if (!context) {
    throw new Error('useFlightInfo must be used within FlightInfoProvider');
  }
  return context;
};
