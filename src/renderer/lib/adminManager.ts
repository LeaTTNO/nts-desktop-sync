// src/renderer/lib/adminManager.ts
// ------------------------------------------------------------
// Ansvar:
// - Håndtere admin-brukere dynamisk (legge til/fjerne admin-roller)
// - Persistere admin-liste i localStorage
// ------------------------------------------------------------

const ADMIN_STORAGE_KEY = "adminUsers";

// Initial admin users (default admins)
const DEFAULT_ADMINS = [
  "lea@tanzaniatours.dk",
  "jakob@tanzaniatours.dk",
  "info@tanzaniatours.dk",
];

/**
 * Get list of admin user emails from localStorage
 */
export function getAdminUsers(): string[] {
  const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
  if (!stored) {
    // Initialize with default admins
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(DEFAULT_ADMINS));
    return DEFAULT_ADMINS;
  }
  try {
    return JSON.parse(stored);
  } catch (error) {
    console.error("Failed to parse admin users from localStorage:", error);
    return DEFAULT_ADMINS;
  }
}

/**
 * Check if a user is an admin
 */
export function isAdminUser(email: string): boolean {
  const admins = getAdminUsers();
  return admins.includes(email.toLowerCase());
}

/**
 * Add a user to the admin list
 */
export function addAdminUser(email: string): void {
  const admins = getAdminUsers();
  const normalizedEmail = email.toLowerCase();
  
  if (!admins.includes(normalizedEmail)) {
    admins.push(normalizedEmail);
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(admins));
  }
}

/**
 * Remove a user from the admin list
 */
export function removeAdminUser(email: string): void {
  const admins = getAdminUsers();
  const normalizedEmail = email.toLowerCase();
  
  const filtered = admins.filter(admin => admin !== normalizedEmail);
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Toggle admin status for a user
 * Returns the new admin status
 */
export function toggleAdminUser(email: string): boolean {
  const isCurrentlyAdmin = isAdminUser(email);
  
  if (isCurrentlyAdmin) {
    removeAdminUser(email);
    return false;
  } else {
    addAdminUser(email);
    return true;
  }
}

/**
 * Reset admin list to defaults
 */
export function resetAdminUsers(): void {
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(DEFAULT_ADMINS));
}
