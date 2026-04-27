const mongoose = require("mongoose");

/**
 * Token Model
 * Persists India Post auth tokens to MongoDB.
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

// ─── Instance methods ─────────────────────────────────────────────────────────

/** True if the access token will expire within `bufferSeconds` seconds. */
tokenSchema.methods.isExpiringSoon = function (bufferSeconds = 300) {
  return Date.now() >= this.expiresAt.getTime() - bufferSeconds * 1000;
};

// ─── Virtuals ─────────────────────────────────────────────────────────────────

/** True if the refresh token is already past its expiry date. */
tokenSchema.virtual("isRefreshExpired").get(function () {
  return Date.now() >= this.refreshExpiresAt.getTime();
});

module.exports = mongoose.model("Token", tokenSchema);
