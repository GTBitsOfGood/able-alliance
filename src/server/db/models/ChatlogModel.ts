import mongoose, { Schema } from "mongoose";
import {
  StudentSnapshotSchema,
  DriverSnapshotSchema,
  type IStudentSnapshot,
  type IDriverSnapshot,
} from "./UserSnapshotSchema";

interface IMessage {
  time: Date;
  // Lowercase to match the room UI's comparison against the session's
  // userType.toLowerCase() (see src/app/rides/[id]/page.tsx).
  senderType: "student" | "driver" | "admin";
  text: string;
}

export interface IChatlog {
  routeId: mongoose.Types.ObjectId;
  student: IStudentSnapshot;
  driver: IDriverSnapshot;
  time: Date;
  status: "active" | "archived";
  archivedAt?: Date;
  messages: IMessage[];
}

const MessageSchema = new Schema<IMessage>({
  time: { type: Date, required: true },
  senderType: {
    type: String,
    enum: ["student", "driver", "admin"],
    required: true,
  },
  text: { type: String, required: true },
});

const ChatlogSchema = new Schema<IChatlog>({
  routeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Route",
    required: true,
  },
  student: {
    type: StudentSnapshotSchema,
    required: true,
  },
  driver: {
    type: DriverSnapshotSchema,
    required: true,
  },
  time: { type: Date, required: true },
  status: {
    type: String,
    enum: ["active", "archived"],
    required: true,
    default: "active",
  },
  archivedAt: { type: Date },
  messages: [MessageSchema],
});

ChatlogSchema.index({ routeId: 1 }, { unique: true });
ChatlogSchema.index({ time: 1 });

const Chatlog =
  (mongoose.models.Chatlog as mongoose.Model<IChatlog>) ??
  mongoose.model<IChatlog>("Chatlog", ChatlogSchema);

export default Chatlog;
