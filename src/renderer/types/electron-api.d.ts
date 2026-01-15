declare global {
  interface Window {
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
