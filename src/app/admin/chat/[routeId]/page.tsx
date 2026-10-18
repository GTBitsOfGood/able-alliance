"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import BogButton from "@/components/BogButton/BogButton";
import AdminChatView from "@/app/admin/AdminChatView";

type RouteDetails = {
  student: { firstName: string; lastName: string };
  status: string;
};

export default function AdminChatPage() {
  const params = useParams<{ routeId: string }>();
  const router = useRouter();
  const [route, setRoute] = useState<RouteDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadRoute = async () => {
      try {
        const response = await fetch(
          `/api/routes?id=${encodeURIComponent(params.routeId)}`,
        );
        if (!response.ok) {
          throw new Error("Unable to load this ride.");
        }

        const data = (await response.json()) as RouteDetails;
        if (!cancelled) setRoute(data);
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load this ride.",
          );
        }
      }
    };

    void loadRoute();
    return () => {
      cancelled = true;
    };
  }, [params.routeId]);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="mb-4 text-sm text-red-700" role="alert">
          {error}
        </p>
        <BogButton variant="secondary" onClick={() => router.back()}>
          Back to chats
        </BogButton>
      </main>
    );
  }

  if (!route) {
    return <main className="mx-auto max-w-3xl p-6">Loading ride chat...</main>;
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <BogButton variant="secondary" size="small" onClick={() => router.back()}>
        Back to chats
      </BogButton>
      <AdminChatView
        routeId={params.routeId}
        rideLabel={`${route.student.firstName} ${route.student.lastName} · ${route.status}`}
        routeStatus={route.status}
        onClose={() => router.back()}
      />
    </main>
  );
}
