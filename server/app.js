// Load env vars FIRST — before anything else
require("dotenv").config();

const express = require("express");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const config = require("./config");
const logger = require("./utils/logger");
const { errorHandler } = require("./middleware/errorHandler");
const { connectDB, getConnectionStatus } = require("./config/database");

// ─── Route imports ────────────────────────────────────────────────────────────
const authRoutes = require("./routes/auth");
const tariffRoutes = require("./routes/tariff");
const pinCodeRoutes = require("./routes/pincode");
const bookingRoutes = require("./routes/booking");
const labelRoutes = require("./routes/label");
const trackingRoutes = require("./routes/tracking");
const webhookRoutes = require("./routes/webhook");

const app = express();

// ─── Rate limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests — please slow down." },
});

// ─── Global middleware ────────────────────────────────────────────────────────
app.use(
  morgan("combined", {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }),
);
app.use(limiter);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "India Post Integration",
    timestamp: new Date().toISOString(),
    environment: config.server.env,
    database: getConnectionStatus(),
  });
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use("/auth", authRoutes);
app.use("/tariff", tariffRoutes);
app.use("/pincode", pinCodeRoutes);
app.use("/booking", bookingRoutes);
app.use("/label", labelRoutes);
app.use("/tracking", trackingRoutes);
app.use("/webhook", webhookRoutes);

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
  });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function start() {
  const PORT = config.server.port;

  // Start HTTP server first — always
  app.listen(PORT, () => {
    logger.info(`✅ India Post Integration server running on port ${PORT}`);
  });

  try {
    await connectDB();
  } catch (err) {
    console.log(err);
  }
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully...`);
  const { disconnectDB } = require("./config/database");
  await disconnectDB();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();

module.exports = app;
