const mongoose = require("mongoose");

/**
 * Token Model
 * Persists India Post auth tokens to MongoDB.
 * Replaces the in-memory tokenStore in authService.js.
 * Uses a single document per "slot" (default: "default").
 */
const tokenSchema = new mongoose.Schema(
  {
    slot: {
      type: String,
      default: "default",
      unique: true,
      index: true,
    },
    accessToken:      { type: String, required: true },
    refreshToken:     { type: String, required: true },
    idToken:          { type: String, default: null },
    expiresAt:        { type: Date,   required: true },
    refreshExpiresAt: { type: Date,   required: true },
  },
  { timestamps: true, collection: "tokens" }
);

// Is the access token expiring within bufferSeconds?
tokenSchema.methods.isExpiringSoon = function (bufferSeconds = 300) {
  return Date.now() >= this.expiresAt.getTime() - bufferSeconds * 1000;
};

module.exports = mongoose.model("Token", tokenSchema);
