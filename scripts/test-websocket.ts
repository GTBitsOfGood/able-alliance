/**
 * WebSocket server integration test.
 *
 * Connects two clients (driver + student) to the running websocket server,
 * exchanges chat messages and location updates, and verifies both sides
 * receive the correct payloads.
 *
 * Run via:
 *   npx tsx scripts/test-websocket.ts [mongodb-url] [ws-url]
 *
 * Defaults:
 *   mongodb: mongodb://localhost:27017/able-alliance?replicaSet=rs0&directConnection=true
 *   ws:      http://localhost:4000
 *
 * The script finds an existing "En-route" route in the DB.
 * If none exists it temporarily promotes the first seeded route, runs the
 * tests, then restores the original status.
 */

import http from "node:http";
import mongoose from "mongoose";
import { io as ioClient, Socket } from "socket.io-client";
import jwt from "jsonwebtoken";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MONGO_URI =
  process.argv[2] ??
  process.env.MONGODB_URI ??
  "mongodb://localhost:27017/able-alliance?replicaSet=rs0&directConnection=true";

const WS_URL = process.argv[3] ?? "http://localhost:4000";

const TIMEOUT_MS = 5000;

const NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET ?? "dev-secret-change-in-production";

function makeToken(userId: string): string {
  return jwt.sign({ userId }, NEXTAUTH_SECRET);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function waitFor<T>(
  socket: Socket,
  event: string,
  timeoutMs = TIMEOUT_MS,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for "${event}"`)),
      timeoutMs,
    );
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function checkServerHealth(): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = new URL("/health", WS_URL);
    const req = http.get(url.toString(), (res) => {
      if (res.statusCode === 200) {
        resolve();
      } else {
        reject(
          new Error(
            `Health check returned HTTP ${res.statusCode} — is the websocket container running?`,
          ),
        );
      }
    });
    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy();
      reject(
        new Error(
          `Health check timed out after ${TIMEOUT_MS}ms.\n` +
            `  Target: ${url}\n` +
            `  Is the websocket container up? Check: docker compose ps`,
        ),
      );
    });
    req.on("error", (err: NodeJS.ErrnoException) => {
      const hint =
        err.code === "ECONNREFUSED"
          ? `\n  The websocket server is not listening on ${WS_URL}.\n` +
            `  Check container logs: docker compose logs websocket`
          : err.code === "ENOTFOUND"
            ? `\n  Hostname not found. Are you using the right URL? (${WS_URL})`
            : "";
      reject(
        new Error(`Health check failed [${err.code ?? err.message}]${hint}`),
      );
    });
  });
}

function connectClient(
  routeId: string,
  userId: string,
  label: string,
): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(WS_URL, {
      auth: { routeId, token: makeToken(userId) },
      transports: ["websocket"],
    });

    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`${label} connection timed out after ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);

    socket.on("connect", () => {
      clearTimeout(timer);
      console.log(`  ✓  ${label} connected (${socket.id})`);
      passed++;
      resolve(socket);
    });

    socket.on("connect_error", (err: Error & { data?: unknown }) => {
      clearTimeout(timer);
      const detail = [
        err.message,
        err.data ? `data=${JSON.stringify(err.data)}` : null,
        (err as NodeJS.ErrnoException).code
          ? `code=${(err as NodeJS.ErrnoException).code}`
          : null,
      ]
        .filter(Boolean)
        .join(" | ");
      reject(new Error(`${label} connect_error: ${detail}`));
    });
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  console.log(`\nWebSocket server : ${WS_URL}`);
  console.log(`MongoDB          : ${MONGO_URI}\n`);

  // ── 0. Health check ───────────────────────────────────────────────────────
  console.log("── Checking websocket server health …");
  try {
    await checkServerHealth();
    console.log(`  ✓  ${WS_URL}/health returned 200`);
  } catch (err) {
    console.error(`  ✗  ${(err as Error).message}`);
    process.exit(1);
  }

  // ── 1. Database ──────────────────────────────────────────────────────────
  console.log("\n── Connecting to MongoDB …");
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;
  const routesCol = db.collection("routes");

  let route = await routesCol.findOne({ status: "En-route" });
  let promoted = false;

  if (!route) {
    console.log(
      '  ⚠  No "En-route" route found — temporarily promoting a seeded route.',
    );
    route = await routesCol.findOne({ "driver._id": { $exists: true } });

    if (!route) {
      console.error(
        "  ✗  No routes with a driver found. Run `npm run seed` first.",
      );
      await mongoose.disconnect();
      process.exit(1);
    }

    await routesCol.updateOne(
      { _id: route._id },
      { $set: { status: "En-route" } },
    );
    promoted = true;
    route = (await routesCol.findOne({ _id: route._id }))!;
    console.log(`  ✓  Promoted route ${route._id} to "En-route"`);
  } else {
    console.log(`  ✓  Using existing "En-route" route: ${route._id}`);
  }

  const routeId = route._id.toString();
  const driverUserId = (
    route.driver as { _id: { toString(): string } }
  )._id.toString();
  const studentUserId = (
    route.student as { _id: { toString(): string } }
  )._id.toString();

  console.log(`     routeId:   ${routeId}`);
  console.log(`     driver:    ${driverUserId}`);
  console.log(`     student:   ${studentUserId}`);

  // ── 2. Connect both clients ───────────────────────────────────────────────
  console.log("\n── Connecting clients …");

  let driverSocket: Socket;
  let studentSocket: Socket;

  try {
    [driverSocket, studentSocket] = await Promise.all([
      connectClient(routeId, driverUserId, "Driver "),
      connectClient(routeId, studentUserId, "Student"),
    ]);
  } catch (err) {
    console.error(`  ✗  ${(err as Error).message}`);
    if (promoted) {
      await routesCol.updateOne(
        { _id: route._id },
        { $set: { status: "Scheduled" } },
      );
    }
    await mongoose.disconnect();
    process.exit(1);
  }

  // ── 3. Reject unauthorised connection ────────────────────────────────────
  console.log("\n── Testing auth rejection …");

  await new Promise<void>((resolve) => {
    const badSocket = ioClient(WS_URL, {
      auth: { routeId, token: makeToken("000000000000000000000000") },
      transports: ["websocket"],
    });
    const timer = setTimeout(() => {
      assert(
        "Unauthorised client rejected",
        false,
        "no connect_error received",
      );
      badSocket.disconnect();
      resolve();
    }, TIMEOUT_MS);

    badSocket.on("connect_error", (err: Error) => {
      clearTimeout(timer);
      assert(
        "Unauthorised client rejected",
        err.message.length > 0,
        err.message,
      );
      badSocket.disconnect();
      resolve();
    });
  });

  // ── 4. Chat: driver → student ─────────────────────────────────────────────
  console.log("\n── Chat: driver → student …");

  const driverMessage = "Hello from driver!";
  const studentReceivesChat = waitFor<string>(
    studentSocket!,
    "receiveChatMessage",
  );
  driverSocket!.emit("sendChatMessage", driverMessage);

  try {
    const received = await studentReceivesChat;
    assert(
      "Student received driver's chat message",
      received === driverMessage,
      `got "${received}"`,
    );
  } catch (err) {
    assert(
      "Student received driver's chat message",
      false,
      (err as Error).message,
    );
  }

  // ── 5. Chat: student → driver ─────────────────────────────────────────────
  console.log("\n── Chat: student → driver …");

  const studentMessage = "Hello from student!";
  const driverReceivesChat = waitFor<string>(
    driverSocket!,
    "receiveChatMessage",
  );
  studentSocket!.emit("sendChatMessage", studentMessage);

  try {
    const received = await driverReceivesChat;
    assert(
      "Driver received student's chat message",
      received === studentMessage,
      `got "${received}"`,
    );
  } catch (err) {
    assert(
      "Driver received student's chat message",
      false,
      (err as Error).message,
    );
  }

  // ── 6. Location: driver → student ────────────────────────────────────────
  console.log("\n── Location: driver → student …");

  const driverLocation = { latitude: 33.7756, longitude: -84.4027 };
  const studentReceivesLocation = waitFor<{
    latitude: number;
    longitude: number;
  }>(studentSocket!, "broadcastLocation");
  driverSocket!.emit("updateLocation", driverLocation);

  try {
    const loc = await studentReceivesLocation;
    assert(
      "Student received driver's location",
      loc.latitude === driverLocation.latitude &&
        loc.longitude === driverLocation.longitude,
      `got ${JSON.stringify(loc)}`,
    );
  } catch (err) {
    assert("Student received driver's location", false, (err as Error).message);
  }

  // ── 7. Location: student → driver ────────────────────────────────────────
  console.log("\n── Location: student → driver …");

  const studentLocation = { latitude: 33.7767, longitude: -84.3891 };
  const driverReceivesLocation = waitFor<{
    latitude: number;
    longitude: number;
  }>(driverSocket!, "broadcastLocation");
  studentSocket!.emit("updateLocation", studentLocation);

  try {
    const loc = await driverReceivesLocation;
    assert(
      "Driver received student's location",
      loc.latitude === studentLocation.latitude &&
        loc.longitude === studentLocation.longitude,
      `got ${JSON.stringify(loc)}`,
    );
  } catch (err) {
    assert("Driver received student's location", false, (err as Error).message);
  }

  // ── 8. Invalid payloads ───────────────────────────────────────────────────
  console.log("\n── Invalid payload handling …");

  const chatError = waitFor<string>(driverSocket!, "chatError", TIMEOUT_MS);
  driverSocket!.emit("sendChatMessage", { not: "a string" });
  try {
    const err = await chatError;
    assert(
      "Server emits chatError for non-string message",
      err.length > 0,
      err,
    );
  } catch {
    assert(
      "Server emits chatError for non-string message",
      false,
      "no chatError",
    );
  }

  const locationError = waitFor<string>(
    driverSocket!,
    "locationError",
    TIMEOUT_MS,
  );
  driverSocket!.emit("updateLocation", { latitude: "bad", longitude: null });
  try {
    const err = await locationError;
    assert(
      "Server emits locationError for bad coordinates",
      err.length > 0,
      err,
    );
  } catch {
    assert(
      "Server emits locationError for bad coordinates",
      false,
      "no locationError",
    );
  }

  // ── 9. Disconnect ─────────────────────────────────────────────────────────
  console.log("\n── Disconnecting …");
  driverSocket!.disconnect();
  studentSocket!.disconnect();
  console.log("  ✓  Both clients disconnected");

  // ── 10. Cleanup ───────────────────────────────────────────────────────────
  if (promoted) {
    await routesCol.updateOne(
      { _id: route._id },
      { $set: { status: "Scheduled" } },
    );
    console.log(`\n  ✓  Route ${route._id} restored to "Scheduled"`);
  }

  await mongoose.disconnect();

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("══════════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("\nUnhandled error:", err);
  process.exit(1);
});
