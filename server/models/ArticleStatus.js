const mongoose = require("mongoose");

/**
 * ArticleStatus Model
 * Stores the CURRENT / LATEST delivery status of each article.
 * One document per article — upserted every time a new event arrives.
 *
 * This is your fast-lookup table:
 *   "What is the current status of article X?" → query this collection.
 * For full history → query TrackingEvent collection.
 */
const articleStatusSchema = new mongoose.Schema(
  {
    articleNumber: { type: String, required: true, unique: true, index: true },
    articleType:   { type: String, default: null },

    // Current delivery status
    deliveryStatus: {
      type: String,
      enum: [
        "booked",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "failed_delivery",
        "returned",
        "unknown",
      ],
      default: "unknown",
      index: true,
    },

    // Latest event snapshot
    latestEventCode:        { type: String, default: null },
    latestEventDescription: { type: String, default: null },
    latestEventOfficeName:  { type: String, default: null },
    latestEventDateTime:    { type: Date,   default: null, index: true },

    // Booking info
    bookingRefId:       { type: String, default: null },
    bookingDate:        { type: String, default: null },
    bookingOfficeName:  { type: String, default: null },
    bookingPin:         { type: Number, default: null },

    // Route
    senderCity:           { type: String, default: null },
    destinationOfficeName:{ type: String, default: null },
    destinationPincode:   { type: Number, default: null },
    destinationCity:      { type: String, default: null },

    // Receiver
    receiverName: { type: String, default: null },

    // Financials
    tariff:      { type: Number, default: null },
    weightValue: { type: Number, default: null },
    codAmount:   { type: Number, default: 0 },

    // Delivery details (populated when delivered)
    deliveredAt:     { type: Date,   default: null },
    deliveryOfficeName: { type: String, default: null },

    // Return details (populated when returned)
    returnedAt:          { type: Date,   default: null },
    nonDeliveryReason:   { type: String, default: null },

    // Customer references
    bulkCustomerId: { type: Number, default: null, index: true },
    contractNumber: { type: Number, default: null },
    reference:      { type: String, default: null },

    // Total event count for this article
    eventCount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "article_statuses" }
);

articleStatusSchema.index({ bulkCustomerId: 1, deliveryStatus: 1 });
articleStatusSchema.index({ deliveryStatus: 1, latestEventDateTime: -1 });

module.exports = mongoose.model("ArticleStatus", articleStatusSchema);
