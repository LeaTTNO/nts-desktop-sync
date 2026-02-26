export {};

declare global {
  interface Window {
    api?: {
      invoke: (channel: string, args?: any) => Promise<any>;
      openPath?: (p: string) => Promise<any>;
      log?: (...args: any[]) => void;
    };
    electron: {
      invoke: (channel: string, args?: any) => Promise<any>;
      openPath: (path: string) => Promise<any>;
      log: (...args: any[]) => void;
      searchFlights: (payload: any) => Promise<any>;
      generatePpt: (args: any) => Promise<any>;
      onAutoSync: (callback: (event: any) => void) => void;
      on: (channel: string, callback: (...args: any[]) => void) => () => void;
    };
  }
}
