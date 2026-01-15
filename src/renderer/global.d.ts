export {};

declare global {
  interface Window {
    api?: {
      invoke: (channel: string, args?: any) => Promise<any>;
      openPath?: (p: string) => Promise<any>;
      log?: (...args: any[]) => void;
    };
  }
}
