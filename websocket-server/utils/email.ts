export async function notifyDriverMessage(
  routeId: string,
  messageId: string,
  token: string,
) {
  const response = await fetch(
    new URL("/api/email/chat", process.env.DEPLOY_PRIME_URL),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ routeId, messageId }),
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    },
  );
  if (!response.ok) {
    throw new Error(`Chat email request failed (${response.status})`);
  }
}
