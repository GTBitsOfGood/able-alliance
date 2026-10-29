import { postEvent } from "./postEvent";

/**
 * Best-effort push of a "locations changed" event to every connected user so
 * open maps and location pickers can refetch. Never throws and is not meant
 * to be awaited.
 */
export function emitLocationsUpdate(): void {
  postEvent({ event: "locationsUpdated" });
}
