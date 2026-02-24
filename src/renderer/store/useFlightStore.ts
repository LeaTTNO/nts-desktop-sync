import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  rawOffer?: any;
  totalDurationMinutes: number;
  hasNightFlight: boolean;
  searchDate?: string;
  nightsDiff?: number;
}

interface MainResults {
  bestAndCheapest: ProcessedFlight | null;
  cheapest: ProcessedFlight | null;
}

interface FlightStoreState {
  // Search results
  mainResults: MainResults;
  bestQualityResult: ProcessedFlight | null;
  cheapestExtendedResult: ProcessedFlight | null;
  flexibleResult: ProcessedFlight | null;
  addNightsResult: ProcessedFlight | null;
  removeNightsResult: ProcessedFlight | null;
  dateIntervalResult: ProcessedFlight | null;
  
  // Search state
  hasSearched: boolean;
  
  // Actions
  setMainResults: (results: MainResults) => void;
  setBestQualityResult: (result: ProcessedFlight | null) => void;
  setCheapestExtendedResult: (result: ProcessedFlight | null) => void;
  setFlexibleResult: (result: ProcessedFlight | null) => void;
  setAddNightsResult: (result: ProcessedFlight | null) => void;
  setRemoveNightsResult: (result: ProcessedFlight | null) => void;
  setDateIntervalResult: (result: ProcessedFlight | null) => void;
  setHasSearched: (searched: boolean) => void;
  resetAll: () => void;
}

const initialState = {
  mainResults: { bestAndCheapest: null, cheapest: null },
  bestQualityResult: null,
  cheapestExtendedResult: null,
  flexibleResult: null,
  addNightsResult: null,
  removeNightsResult: null,
  dateIntervalResult: null,
  hasSearched: false,
};

export const useFlightStore = create<FlightStoreState>()(
  persist(
    (set) => ({
      ...initialState,
      
      setMainResults: (results) => set({ mainResults: results }),
      setBestQualityResult: (result) => set({ bestQualityResult: result }),
      setCheapestExtendedResult: (result) => set({ cheapestExtendedResult: result }),
      setAddNightsResult: (result) => set({ addNightsResult: result }),
      setRemoveNightsResult: (result) => set({ removeNightsresult }),
      setExtendedStayResult: (result) => set({ extendedStayResult: result }),
      setDateIntervalResult: (result) => set({ dateIntervalResult: result }),
      setHasSearched: (searched) => set({ hasSearched: searched }),
      
      resetAll: () => set(initialState),
    }),
    {
      name: 'flight-search-results', // localStorage key
      partialize: (state) => ({
        mainResults: state.mainResults,
        bestQualityResult: state.bestQualityResult,
        cheapestExtendedResult: state.cheapestExtendedResult,
        addNightsResult: state.addNightsResult,
        removeNightsResult: state.removeNightsResult,
        dateIntervalResult: state.dateIntervalResult,
        hasSearched: state.hasSearched,
      }),
    }
  )
);
