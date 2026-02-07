import mongoose, { Schema, Document } from 'mongoose';

const MessageSchema = new Schema({
  time: { type: Date, required: true },
  senderType: { type: String, enum: ['Student', 'Driver'], required: true },
  text: { type: String, required: true },
});

const ChatlogSchema = new Schema({
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true },
  time: { type: Date, required: true },
  messages: [MessageSchema],
});

const Chatlog = mongoose.model('Chatlog', ChatlogSchema);

export default Chatlog;