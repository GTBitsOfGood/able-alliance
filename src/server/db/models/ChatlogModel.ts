import mongoose, { Schema } from "mongoose";
import { BaseUserSchema, StudentSchema } from "./UserModel";
import type { IBaseUser, IStudentUser } from "./UserModel";

interface IMessage {
  time: Date;
  senderType: "Student" | "Driver";
  text: string;
}

export interface IChatlog {
  routeId: mongoose.Types.ObjectId;
  student: IStudentUser & { _id: mongoose.Types.ObjectId };
  driver: IBaseUser & { _id: mongoose.Types.ObjectId };
  time: Date;
  messages: IMessage[];
}

const MessageSchema = new Schema<IMessage>({
  time: { type: Date, required: true },
  senderType: { type: String, enum: ["Student", "Driver"], required: true },
  text: { type: String, required: true },
});

const ChatlogSchema = new Schema<IChatlog>({
  routeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Route",
    required: true,
  },
  student: {
    type: StudentSchema,
    required: true,
  },
  driver: {
    type: BaseUserSchema,
    required: true,
  },
  time: { type: Date, required: true },
  messages: [MessageSchema],
});

ChatlogSchema.index({ routeId: 1 });
ChatlogSchema.index({ time: 1 });

const Chatlog =
  (mongoose.models.Chatlog as mongoose.Model<IChatlog>) ??
  mongoose.model<IChatlog>("Chatlog", ChatlogSchema);

export default Chatlog;
