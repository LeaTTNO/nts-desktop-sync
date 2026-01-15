import { Configuration, LogLevel } from "@azure/msal-browser";

/**
 * MSAL Configuration for Microsoft Azure AD authentication.
 * NTS Tanzania Tours - Production config
 */
export const msalConfig: Configuration = {
  auth: {
    clientId: "c3367131-c6f7-4cf2-bd65-cc5ddd664183",
    authority: "https://login.microsoftonline.com/86e7101d-2b71-4a68-abed-8b44db20b94a",
    redirectUri: typeof window !== "undefined" ? window.location.origin : "http://localhost",
    postLogoutRedirectUri: typeof window !== "undefined" ? window.location.origin : "http://localhost",
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            break;
          case LogLevel.Warning:
            console.warn(message);
            break;
        }
      },
      logLevel: LogLevel.Warning,
    },
  },
};

export const loginRequest = {
  scopes: ["User.Read", "Files.Read"],
};

export const oneDriveRequest = {
  scopes: ["Files.Read", "Files.Read.All"],
};
