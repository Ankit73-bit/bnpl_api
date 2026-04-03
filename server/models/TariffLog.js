const mongoose = require("mongoose");

/**
 * TariffLog Model
 * Logs every tariff calculation request and its result.
 * Useful for auditing, cost estimation reports, and debugging.
 */
const tariffLogSchema = new mongoose.Schema(
  {
    productType: {
      type: String,
      enum: ["SP", "BP"],  // SP = Speed Post, BP = Business Parcel
      required: true,
      index: true,
    },

    // Request params
    weight:              { type: Number, required: true },
    sourcePincode:       { type: String, required: true },
    destinationPincode:  { type: String, required: true, index: true },
    length:              { type: Number },
    width:               { type: Number },
    height:              { type: Number },
    insValue:            { type: Number, default: null },
    pod:                 { type: String, default: null },  // "YES" / "NO"

    // Response data
    chargeableWeight:    { type: Number, default: null },
    volumetricWeight:    { type: Number, default: null },
    distanceKm:          { type: Number, default: null },
    baseTariff:          { type: Number, default: null },
    insuranceCharge:     { type: Number, default: null },
    podCharge:           { type: Number, default: null },
    cgst:                { type: Number, default: null },
    sgst:                { type: Number, default: null },
    igst:                { type: Number, default: null },
    totalTax:            { type: Number, default: null },
    totalWithTax:        { type: Number, default: null },
    currency:            { type: String, default: "INR" },

    // Raw India Post response
    rawResponse: { type: mongoose.Schema.Types.Mixed, default: null },

    success: { type: Boolean, default: true },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true, collection: "tariff_logs" }
);

tariffLogSchema.index({ sourcePincode: 1, destinationPincode: 1 });
tariffLogSchema.index({ productType: 1, createdAt: -1 });

module.exports = mongoose.model("TariffLog", tariffLogSchema);
