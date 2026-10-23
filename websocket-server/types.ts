import type { Server, Socket, Namespace } from "socket.io";
import type {
  User,
  Message,
  Location as DatabaseLocation,
} from "@db/generated/client";

export type Coordinates = Pick<DatabaseLocation, "latitude" | "longitude">;

export interface ClientEvents {
  sendChatMessage: (text: unknown) => void;
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
  notification: (payload: { type: string; message: string }) => void;
}

export interface SocketData {
  user: string;
  routeId: string;
  userType: string;
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
