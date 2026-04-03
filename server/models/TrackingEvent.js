const mongoose = require("mongoose");

/**
 * TrackingEvent Model
 * Stores real-time events received via webhook from India Post,
 * AND events fetched via the bulk tracking API.
 *
 * Each document = one event for one article.
 */
const trackingEventSchema = new mongoose.Schema(
  {
    // Article identification
    articleNumber:   { type: String, required: true, index: true },
    articleType:     { type: String, default: null },     // e.g. "SP_INLAND_PARCEL"

    // Event details
    eventCode:       { type: String, required: true },    // e.g. "ITEM_DELIVERED", "BAG_CLOSE"
    eventDescription:{ type: String, default: null },
    eventDate:       { type: String, default: null },     // "2025-11-09" (raw from India Post)
    eventTime:       { type: String, default: null },     // "08:37:52"
    eventDateTime:   { type: Date,   default: null },     // parsed combined datetime (indexed)

    // Office info
    eventOfficeFacilityId: { type: String, default: null },
    eventOfficeName:       { type: String, default: null },

    // Booking details (populated from webhook payload)
    bookingRefId:    { type: String, default: null },
    bookingDate:     { type: String, default: null },
    bookingTime:     { type: String, default: null },
    bookingOfficeFacilityId: { type: String, default: null },
    bookingOfficeName:       { type: String, default: null },
    bookingPin:      { type: Number, default: null },

    // Route info
    senderAddressCity:          { type: String, default: null },
    destinationOfficeFacilityId:{ type: Number, default: null },
    destinationOfficeName:      { type: String, default: null },
    destinationPincode:         { type: Number, default: null, index: true },
    destinationCity:            { type: String, default: null },
    destinationCountry:         { type: String, default: null },

    // Receiver
    receiverName:    { type: String, default: null },

    // Financial
    tariff:          { type: Number, default: null },
    weightValue:     { type: Number, default: null },
    codAmount:       { type: Number, default: null },

    // Misc
    nonDeliveryReason: { type: String, default: null },
    invoiceNo:         { type: String, default: null },
    lineItem:          { type: String, default: null },
    bookingType:       { type: String, default: null },
    contractNumber:    { type: Number, default: null },
    reference:         { type: String, default: null },
    bulkCustomerId:    { type: Number, default: null, index: true },

    // Source: was this from a webhook push or a pull via tracking API?
    source: {
      type: String,
      enum: ["webhook", "tracking_api", "event_api"],
      required: true,
      default: "webhook",
    },
  },
  { timestamps: true, collection: "tracking_events" }
);

// Compound indexes for common queries
trackingEventSchema.index({ articleNumber: 1, eventDateTime: -1 });
trackingEventSchema.index({ articleNumber: 1, eventCode: 1 });
trackingEventSchema.index({ bulkCustomerId: 1, createdAt: -1 });

module.exports = mongoose.model("TrackingEvent", trackingEventSchema);
