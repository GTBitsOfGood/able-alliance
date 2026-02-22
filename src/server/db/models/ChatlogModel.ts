import mongoose, { Schema } from "mongoose";
import { BaseUserSchema, StudentSchema } from "./UserModel";

const MessageSchema = new Schema({
  time: { type: Date, required: true },
  senderType: { type: String, enum: ["Student", "Driver"], required: true },
  text: { type: String, required: true },
});

const ChatlogSchema = new Schema({
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

const Chatlog =
  (mongoose.models.Chatlog as mongoose.Model<typeof ChatlogSchema>) ??
  mongoose.model("Chatlog", ChatlogSchema);

export default Chatlog;
