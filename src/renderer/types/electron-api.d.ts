declare global {
  interface Window {
    electron: {
      invoke: (channel: string, args?: any) => Promise<any>;
      openPath: (path: string) => Promise<any>;
      log: (...args: any[]) => void;
      searchFlights: (payload: any) => Promise<any>;
      generatePpt: (args: any) => Promise<{
        fileName: string;
        buffer: ArrayBuffer;
      }>;
      onAutoSync: (callback: (event: any) => void) => void;
    };
    electronAPI: {
      importFromOneDrive: (args: { language: "no" | "dk" }) => Promise<any[]>;
      generatePpt: (args: any) => Promise<{
        fileName: string;
        buffer: ArrayBuffer;
      }>;
    };
  }
}

export {};
