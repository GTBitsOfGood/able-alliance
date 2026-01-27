import mongoose, { Connection } from "mongoose";

export const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("Error: MONGODB_URI environment variable is not defined");
  throw new Error(
    "Please define the MONGODB_URI environment variable inside .env",
  );
}

declare global {
  var mongoose: {
    conn: Connection | null;
    promise: Promise<Connection> | null;
  };
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectMongoDB = async () => {
  if (cached.conn) {
    return cached.conn as Connection;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose
      .connect(uri, opts)
      .then((m) => {
        return m.connection as Connection;
      })
      .catch((error: unknown) => {
        console.error("MongoDB connection promise failed:", error);
        cached.promise = null;
        throw new Error(
          "MongoDB connection failed. Check your connection settings.",
        );
      });
  }

  try {
    cached.conn = await cached.promise;
    if (cached.conn.readyState === 1) {
      return cached.conn;
    }
    throw new Error(
      "MongoDB connection state is not 'open'. Please check the connection.",
    );
  } catch (error) {
    cached.promise = null;
    console.error("Failed to connect to MongoDB:", error);
    throw new Error(
      "Failed to connect to MongoDB. Please check your MongoDB URI and network.",
    );
  }
};

export default connectMongoDB;
