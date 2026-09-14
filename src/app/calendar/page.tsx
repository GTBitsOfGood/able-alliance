import { Suspense } from "react";
import CalendarView from "./CalendarView";

/**
 * CalendarView reads the ?error=/?connected= params the OAuth callback redirects
 * with, so it needs a Suspense boundary — useSearchParams opts the subtree into
 * client-side rendering and `next build` fails without one.
 */
export default function CalendarPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}>Loading…</main>}>
      <CalendarView />
    </Suspense>
  );
}
