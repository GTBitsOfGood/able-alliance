export async function register() {
  // Only run in the Node.js runtime (not Edge) so we can reach PostgreSQL
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initSuperAdmin } =
      await import("@/server/db/actions/initSuperAdmin");
    await initSuperAdmin();
  }
}
