import type { Types } from "mongoose";
import type { Server, Socket, Namespace } from "socket.io";

export interface RouteUser {
  _id: Types.ObjectId;
}

export interface RouteForAuth {
  scheduledPickupTime: Date;
  status: string;
  student: RouteUser;
  driver?: RouteUser;
}

export interface ChatMessage {
  _id: Types.ObjectId;
  senderType: "driver" | "student" | "admin";
  text: string;
  time: Date;
}

export interface Chatlog {
  routeId: Types.ObjectId;
  status: "active" | "archived";
  messages: ChatMessage[];
}

export interface Location {
  latitude: number;
  longitude: number;
}

export interface ClientEvents {
  sendChatMessage: (text: unknown) => void;
  updateLocation: (location: Location) => void;
  closeRouteRoom: () => void;
}

export interface ServerEvents {
  chatHistory: (history: ChatMessage[]) => void;
  receiveChatMessage: (message: ChatMessage) => void;
  broadcastLocation: (location: Location) => void;
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
  routeStudent?: RouteUser;
  routeDriver?: RouteUser;
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
