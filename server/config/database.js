const mongoose = require("mongoose");
const logger = require("../utils/logger");

let isConnected = false;

async function connectDB() {
  if (isConnected) {
    logger.debug("MongoDB: Already connected — reusing existing connection.");
    return;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not defined in environment variables.");
  }

  // Log a sanitised version of the URI so you can confirm it's being read correctly
  const sanitised = uri.replace(/:([^@]+)@/, ":****@");

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000, // give Atlas 15s (SRV lookup can be slow)
      socketTimeoutMS: 45000,
      connectTimeoutMS: 15000,
      // Atlas SRV requires these for stable connections
      retryWrites: true,
      w: "majority",
    });

    isConnected = true;
    logger.info(`✅ MongoDB connected: ${mongoose.connection.host}`);

    mongoose.connection.on("disconnected", () => {
      isConnected = false;
      logger.warn("MongoDB: Disconnected.");
    });
    mongoose.connection.on("reconnected", () => {
      isConnected = true;
      logger.info("MongoDB: Reconnected.");
    });
    mongoose.connection.on("error", (err) => {
      logger.error(`MongoDB error: ${err.message}`);
    });
  } catch (err) {
    // Provide a clear, actionable error message
    console.log(err);

    // throw err;
  }
}

async function disconnectDB() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  logger.info("MongoDB: Disconnected cleanly.");
}

function getConnectionStatus() {
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };
  return {
    state: states[mongoose.connection.readyState] || "unknown",
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null,
  };
}

module.exports = { connectDB, disconnectDB, getConnectionStatus };
