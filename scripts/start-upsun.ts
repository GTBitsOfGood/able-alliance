import next from "next";
import { startServer } from "../websocket-server/server";

process.env.PORT ??= "3000";

const app = next({
  dev: false,
  hostname: "0.0.0.0",
  port: Number(process.env.PORT),
});

async function main() {
  await app.prepare();
  await startServer(app.getRequestHandler());
}

void main().catch((error: unknown) => {
  console.error("Failed to start the combined server", error);
  process.exit(1);
});
