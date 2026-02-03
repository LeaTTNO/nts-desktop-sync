// Context for sharing flight information between FlightRobot and TravelProgramBuilder
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

const STORAGE_KEY = 'saved-flights';

export const FlightInfoProvider = ({ children }: { children: ReactNode }) => {
  // Initialize from localStorage
  const [savedFlights, setSavedFlights] = useState<FlightInfo[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load saved flights:', error);
      return [];
    }
  });

  // Persist to localStorage whenever savedFlights changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedFlights));
    } catch (error) {
      console.error('Failed to save flights:', error);
    }
  }, [savedFlights]);

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
    localStorage.removeItem(STORAGE_KEY);
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
