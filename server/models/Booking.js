const mongoose = require("mongoose");

/**
 * Booking Model
 * Stores every bulk booking request made to India Post,
 * along with the full response (valid articles + error articles).
 */

// ─── Sub-schema: individual article result ───────────────────────────────────
const articleResultSchema = new mongoose.Schema(
  {
    barcodeNo:        { type: String, index: true },
    index:            { type: Number },
    timestamp:        { type: Date },
    offsetNumber:     { type: String, default: null },
    blockNumber:      { type: Number, default: null },
    calculatedTariff: { type: Number, default: null },
    currency:         { type: String, default: "INR" },
    // renamed from "errors" → "validationErrors" to avoid Mongoose reserved key warning
    validationErrors: [{ type: String }],
  },
  { _id: false, suppressReservedKeysWarning: true }
);

// ─── Sub-schema: article input payload ───────────────────────────────────────
const articleInputSchema = new mongoose.Schema(
  {
    barcodeNo:       { type: String },
    articleType:     { type: String, enum: ["SP", "BP"] },
    physicalWeight:  { type: Number },
    senderName:      { type: String },
    senderPincode:   { type: String },
    senderCity:      { type: String },
    receiverName:    { type: String },
    receiverPincode: { type: String },
    receiverCity:    { type: String },
    pickupOrDropoff: { type: String, enum: ["PICKUP", "DROPOFF", "pickup", "dropoff"] },
    dropOffPincode:  { type: String },
    bulkReference:   { type: String },
  },
  { _id: false }
);

// ─── Main booking schema ──────────────────────────────────────────────────────
const bookingSchema = new mongoose.Schema(
  {
    // Customer info
    customId:    { type: String, required: true, index: true },
    contractId:  { type: String },

    // Method used to submit
    inputMethod: {
      type: String,
      enum: ["json_body", "file_upload"],
      required: true,
    },

    // India Post response identifiers
    batchId:          { type: String, index: true },
    mailBookingDomId: { type: String },
    correlationId:    { type: String },

    // Summary counts
    totalArticles:     { type: Number, default: 0 },
    processed:         { type: Number, default: 0 },
    successCount:      { type: Number, default: 0 },
    errorCount:        { type: Number, default: 0 },
    totalTariffAmount: { type: Number, default: 0 },
    currency:          { type: String, default: "INR" },

    // Article detail arrays
    articleInputs: [articleInputSchema],  // what we sent
    validArticles: [articleResultSchema], // India Post accepted
    errorArticles: [articleResultSchema], // India Post rejected

    // Booking status
    status: {
      type: String,
      enum: ["pending", "submitted", "partial", "failed"],
      default: "pending",
      index: true,
    },

    // Raw India Post response (for debugging)
    rawResponse: { type: mongoose.Schema.Types.Mixed, default: null },

    // Timestamp returned by India Post
    indiaPostTimestamp: { type: Date, default: null },
  },
  { timestamps: true, collection: "bookings" }
);

// Compound indexes for common queries
bookingSchema.index({ customId: 1, createdAt: -1 });
bookingSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Booking", bookingSchema);
