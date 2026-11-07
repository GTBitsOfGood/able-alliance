import type { RouteStatus } from "../db/generated/enums.js";
import type { Server, Socket, Namespace } from "socket.io";
import type {
  User,
  Message,
  Location as DatabaseLocation,
} from "@db/generated/client";

export type Coordinates = Pick<DatabaseLocation, "latitude" | "longitude">;

/** What the sender hears back about one send attempt. */
export type SendChatAck =
  | { status: "ok"; message: Message }
  | { status: "error"; error: string; retryable: boolean };

export interface ClientEvents {
  sendChatMessage: (
    payload: unknown,
    ack?: (result: SendChatAck) => void,
  ) => void;
  updateLocation: (location: Coordinates) => void;
  closeRouteRoom: () => void;
}

export interface ServerEvents {
  chatHistory: (history: Message[]) => void;
  receiveChatMessage: (message: Message) => void;
  broadcastLocation: (location: Coordinates) => void;
  routeClosed: () => void;
  chatError: (message: string) => void;
  locationError: (message: string) => void;
  connectionError: (message: string) => void;
  closeRouteRoomError: (message: string) => void;
  accessRevoked: (payload: { reason: string; message: string }) => void;
  notification: (payload: {
    type: string;
    message: string;
    activeType: string;
  }) => void;
  routeUpdated: (payload: { routeId: string; status: RouteStatus }) => void;
  locationsUpdated: () => void;
}

export interface SocketData {
  user: string;
  routeId: string;
  userType: string;
  /** Token expiry in epoch seconds, used to drop the socket when it lapses. */
  tokenExp?: number;
  routeStudent?: Pick<User, "id">;
  routeDriver?: Pick<User, "id"> | null;
}

export type InterServerEvents = Record<string, never>;
export type AppServer = Server<
  ClientEvents,
  ServerEvents,
  InterServerEvents,
  SocketData
>;
export type AppSocket = Socket<
  ClientEvents,
  ServerEvents,
  InterServerEvents,
  SocketData
>;
export type AppNamespace = Namespace<
  ClientEvents,
  ServerEvents,
  InterServerEvents,
  SocketData
>;
export type AuthNext = (error?: Error) => void;
