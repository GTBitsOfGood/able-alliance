/**
 * Server-side Mapbox utility.
 * Uses MAPBOX_TOKEN (secret token, directions:read scope) — never NEXT_PUBLIC_MAPBOX_TOKEN.
 */

const DIRECTIONS_BASE =
  "https://api.mapbox.com/directions/v5/mapbox/driving-traffic";

/**
 * Returns the estimated travel duration in seconds between two coordinates,
 * using Mapbox driving-traffic profile with historical traffic for the given
 * departure time. Returns null if the request fails for any reason so that
 * callers can degrade gracefully.
 */
export async function getMapboxTravelDuration(
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
  departAt: Date,
): Promise<number | null> {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    console.warn(
      "[mapbox] MAPBOX_TOKEN is not set — skipping travel time estimate",
    );
    return null;
  }

  const coords = `${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}`;
  // Strip milliseconds — Mapbox accepts YYYY-MM-DDThh:mm:ssZ, not .000Z
  const departAtIso = departAt.toISOString().replace(/\.\d{3}Z$/, "Z");

  const url =
    `${DIRECTIONS_BASE}/${coords}` +
    `?depart_at=${encodeURIComponent(departAtIso)}` +
    `&access_token=${token}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[mapbox] Directions API responded ${res.status}`);
      return null;
    }
    const json = (await res.json()) as {
      code?: string;
      routes?: { duration: number }[];
    };
    if (json.code !== "Ok" || !json.routes?.length) {
      console.warn("[mapbox] Directions API returned no routes:", json.code);
      return null;
    }
    return json.routes[0].duration;
  } catch (e) {
    console.warn("[mapbox] Directions API fetch failed:", e);
    return null;
  }
}
