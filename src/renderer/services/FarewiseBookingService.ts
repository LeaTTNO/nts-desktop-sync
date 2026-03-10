/**
 * FarewiseBookingService — renderer-side service for Farewise flight booking.
 * All API calls go through IPC to the Electron main process (which holds the authenticated session).
 */

/**
 * Extract datasource identifier from a raw Farewise recommendation.
 * Priority: rec.dataSources[0] → route.dataSource.key → parse prefix from rec.id
 */
export function extractDataSource(rawRecommendation: any): string {
  if (!rawRecommendation) return "";

  // 1. Direct dataSources array
  if (Array.isArray(rawRecommendation.dataSources) && rawRecommendation.dataSources.length > 0) {
    return String(rawRecommendation.dataSources[0]);
  }

  // 2. dataSource on the first route of the first leg
  const firstRoute = rawRecommendation.options?.[0]?.legs?.[0]?.routes?.[0];
  if (firstRoute?.dataSource?.key) {
    return String(firstRoute.dataSource.key);
  }

  // 3. Parse from recommendation id — e.g. "Amadeus.noOSLJROJROOSL0" → "Amadeus.no"
  const id: string = rawRecommendation.id || "";
  const match = id.match(/^([A-Za-z]+\.[a-z]{2})/);
  if (match) return match[1];

  return "";
}

/**
 * Extract Farewise-native segments from a raw recommendation.
 * Returns segments exactly as received from the Farewise search response.
 */
export function extractSegments(rawRecommendation: any): any[] {
  if (!rawRecommendation) return [];
  const legs: any[] = rawRecommendation.options?.[0]?.legs ?? [];
  return legs.flatMap((leg: any) => leg.routes?.[0]?.segments ?? []);
}

/**
 * Create a Farewise reservation and return the PNR.
 */
export async function createReservation(
  datasource: string,
  recommendationId: string,
  segments: any[],
  adults: number,
  children: number,
  language: string
): Promise<{ pnr: string; datasource: string }> {
  const result = await window.electron.invoke("farewise:createReservation", {
    datasource,
    recommendationId,
    segments,
    adults,
    children,
    language,
  });
  if (!result?.ok) throw new Error(result?.error || "Reservation creation failed");
  return { pnr: result.pnr, datasource: result.datasource ?? datasource };
}

/**
 * Open the Farewise booking page for a given PNR in the default browser.
 */
export async function openFarewiseBooking(
  pnr: string,
  datasource: string,
  language: string
): Promise<void> {
  await window.electron.invoke("farewise:openBooking", { pnr, datasource, language });
}
