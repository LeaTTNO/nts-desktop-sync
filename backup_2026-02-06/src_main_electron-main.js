// --- Søk-abortering ---
const activeSearches = new Map(); // searchId -> AbortController

ipcMain.handle("farewise:searchFlights", async (event, params) => {
  const searchId = params && params.searchId;
  let abortController;
  if (searchId) {
    abortController = new AbortController();
    activeSearches.set(searchId, abortController);
  }
  try {
    const result = await searchFlightsMain(params, abortController?.signal);
    return { ok: true, data: result.data };
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn('Søk avbrutt:', searchId);
      return { ok: false, error: 'Søk avbrutt' };
    }
    console.error("Farewise search error:", err);
    return { ok: false, error: String(err) };
  } finally {
    if (searchId) activeSearches.delete(searchId);
  }
});

ipcMain.handle("farewise:abortSearch", async (event, searchId) => {
  const ctrl = activeSearches.get(searchId);
  if (ctrl) {
    ctrl.abort();
    activeSearches.delete(searchId);
    return { ok: true };
  }
  return { ok: false, error: 'Ingen aktivt søk med denne ID' };
});
// ...existing code...
