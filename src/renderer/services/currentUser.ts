// src/services/currentUser.ts
import { AccountInfo } from "@azure/msal-browser";
import {
  getActiveLanguage,
  getUserBaseFolder,
  SupportedLanguage,
} from "./userConfig";

type CurrentUser = {
  email: string;
  language: SupportedLanguage;
  baseFolder: string;
};

let currentUser: CurrentUser | null = null;

export function initCurrentUser(account: AccountInfo) {
  const email = account.username.toLowerCase();
  const language = getActiveLanguage(email);
  const baseFolder = getUserBaseFolder(email, language);

  currentUser = {
    email,
    language,
    baseFolder,
  };

  console.log("✅ Current user initialized:", currentUser);
}

export function getCurrentUser(): CurrentUser {
  if (!currentUser) {
    throw new Error("CurrentUser not initialized");
  }
  return currentUser;
}
