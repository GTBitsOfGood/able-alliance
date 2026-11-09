export type LineStringGeometry = {
  type: "LineString";
  coordinates: [number, number][];
};

export async function getDirectionsGeometry(
  pickup: [number, number],
  dropoff: [number, number],
  token: string,
  profile: "driving" | "driving-traffic",
): Promise<LineStringGeometry | null> {
  const coordinates = `${pickup.join(",")};${dropoff.join(",")}`;
  const query = new URLSearchParams({
    overview: "full",
    geometries: "geojson",
    access_token: token,
  });
  const response = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?${query}`,
  );

  if (!response.ok) {
    throw new Error(`Directions API responded with ${response.status}`);
  }

  const data = (await response.json()) as {
    routes?: Array<{ geometry?: LineStringGeometry }>;
  };
  return data.routes?.[0]?.geometry ?? null;
}

/** Mapbox paint values must be resolved values rather than CSS variables. */
export function getRouteLinePaint(container: HTMLElement) {
  const theme = getComputedStyle(container);
  return {
    "line-color": theme.getPropertyValue("--color-map-route").trim(),
    "line-width": parseFloat(theme.getPropertyValue("--map-route-width")),
    "line-opacity": parseFloat(theme.getPropertyValue("--map-route-opacity")),
  };
}
