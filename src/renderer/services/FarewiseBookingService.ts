/**
 * FarewiseBookingService — renderer-side service for Farewise flight booking.
 * All API calls go through IPC to the Electron main process (which holds the authenticated session).
 */

/**
 * Extract datasource identifier from a raw Farewise recommendation.
 * Priority:
 * 1) rec.dataSources[0]
 * 2) route.dataSource.key
 * 3) parse prefix from rec.id
 */
export function extractDataSource(rawRecommendation: any): string {
  if (!rawRecommendation) return "";

  // 1. Direct dataSources array
  if (
    Array.isArray(rawRecommendation.dataSources) &&
    rawRecommendation.dataSources.length > 0
  ) {
    return String(rawRecommendation.dataSources[0]).trim();
  }

  // 2. datasource inside route — supports both options[].legs[] and legs[] formats
  const firstRoute =
    rawRecommendation.options?.[0]?.legs?.[0]?.routes?.[0] ??
    rawRecommendation.legs?.[0]?.routes?.[0];

  if (firstRoute?.dataSource?.key) {
    return String(firstRoute.dataSource.key).trim();
  }

  // 3. Parse from recommendation id — e.g. "Amadeus.noOSLJROJROOSL0" → "Amadeus.no"
  const id: string = rawRecommendation.id || "";
  const match = id.match(/^([A-Za-z0-9\.\-]+)/);
  if (match) {
    return match[1].trim();
  }

  console.warn("⚠️ Could not detect Farewise datasource", rawRecommendation);
  return "";
}

/**
 * Extract Farewise-native segments from a raw recommendation (flat list).
 * Supports both recommendation.options[].legs[] and recommendation.legs[] formats.
 */
export function extractSegments(rawRecommendation: any): any[] {
  if (!rawRecommendation) return [];

  const legs =
    rawRecommendation.options?.[0]?.legs ??
    rawRecommendation.legs ??
    [];

  const segments = legs.flatMap((leg: any) => leg.routes?.[0]?.segments ?? []);

  if (!segments.length) {
    console.warn("⚠️ No Farewise segments found", rawRecommendation);
  }

  return segments;
}

/**
 * Extract Farewise routes for booking API.
 * Each leg becomes a route entry with its own segments, preserving the structure
 * required by the Farewise booking endpoint.
 */
export function extractRoutes(rawRecommendation: any): any[] {
  if (!rawRecommendation) return [];

  const legs =
    rawRecommendation.options?.[0]?.legs ??
    rawRecommendation.legs ??
    [];

  const routes = legs
    .map((leg: any) => {
      const route = leg.routes?.[0];
      if (!route?.segments?.length) return null;
      return {
        segments: route.segments,
        totalTime: route.totalTime || leg.totalTime || "",
        majorityCarrier: route.majorityCarrier || "",
        validatingCarrier: route.validatingCarrier || "",
        transaction: route.transaction || "",
      };
    })
    .filter(Boolean);

  if (!routes.length) {
    console.warn("⚠️ No Farewise routes found for booking", rawRecommendation);
  }

  return routes;
}

/**
 * Create a Farewise reservation and return the PNR.
 * Routes must be extracted via extractRoutes() — each route contains segments as-is from Farewise.
 */
export async function createReservation(
  datasource: string,
  recommendationId: string,
  routes: any[],
  adults: number,
  children: number,
  language: string
): Promise<{ pnr: string; datasource: string }> {
  if (!datasource) throw new Error("Missing Farewise datasource");
  if (!recommendationId) throw new Error("Missing Farewise recommendationId");
  if (!routes || routes.length === 0) throw new Error("No Farewise routes found for reservation");

  const result = await window.electron.invoke("farewise:createReservation", {
    datasource: datasource.trim(),
    recommendationId,
    routes,
    adults,
    children,
    language,
  });

  if (!result?.ok) throw new Error(result?.error || "Farewise reservation creation failed");

  return {
    pnr: result.pnr,
    datasource: result.datasource ?? datasource,
  };
}

/**
 * Open the Farewise booking page for a given PNR in the default browser.
 */
export async function openFarewiseBooking(
  pnr: string,
  datasource: string,
  language: string
): Promise<void> {
  if (!pnr) throw new Error("Missing Farewise PNR");
  if (!datasource) throw new Error("Missing Farewise datasource for booking URL");

  await window.electron.invoke("farewise:openBooking", {
    pnr,
    datasource: datasource.trim(),
    language,
  });
}
