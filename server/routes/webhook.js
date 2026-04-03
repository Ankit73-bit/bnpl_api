const express = require("express");
const router = express.Router();
const { asyncHandler } = require("../middleware/errorHandler");
const { saveWebhookEvent } = require("../services/trackingService");
const logger = require("../utils/logger");

/**
 * POST /webhook/events
 *
 * India Post pushes real-time tracking events to this endpoint.
 *
 * Setup in Self Service Portal:
 *   Settings → Master Configuration → Event Configuration
 *   → Select "Webhook" → enter your public URL + static IP
 */
router.post(
  "/events",
  asyncHandler(async (req, res) => {
    const payload = req.body;

    // Respond immediately — India Post expects a fast 200
    res.status(200).json({ received: true });

    // Process + persist asynchronously after responding
    setImmediate(() => _processWebhookEvent(payload));
  }),
);

/**
 * GET /webhook/events
 * Reachability check — confirms the webhook URL is live.
 */
router.get("/events", (req, res) => {
  res.json({
    success: true,
    message: "India Post webhook endpoint is active",
    timestamp: new Date().toISOString(),
  });
});

// ─── Event processing ─────────────────────────────────────────────────────────

async function _processWebhookEvent(payload) {
  try {
    if (!payload || !payload.article_number) {
      logger.warn(
        "Webhook: Received payload with no article_number — skipping",
      );
      return;
    }

    const {
      article_number,
      event_code,
      event_description,
      event_office_name,
      event_date,
      event_time,
    } = payload;

    logger.info(
      `Webhook ▶ ${article_number} | ${event_code} (${event_description}) | ${event_office_name} | ${event_date} ${event_time}`,
    );

    // 1. Persist to MongoDB (TrackingEvent + upsert ArticleStatus)
    await saveWebhookEvent(payload);

    // 2. Route to business logic handlers
    switch (event_code) {
      case "ITEM_BOOK":
        _onItemBooked(payload);
        break;
      case "BAG_CLOSE":
      case "ITEM_DISPATCHED":
      case "ITEM_BAGGED":
        _onItemInTransit(payload);
        break;
      case "ITEM_DELIVERED":
        _onItemDelivered(payload);
        break;
      case "ITEM_RETURNED":
      case "RTS":
        _onItemReturned(payload);
        break;
      case "ITEM_NOT_DELIVERED":
        _onDeliveryFailed(payload);
        break;
      default:
        logger.debug(
          `Webhook: No handler for event code "${event_code}" — event saved to DB.`,
        );
    }
  } catch (err) {
    logger.error(
      `Webhook: Error processing event for ${payload?.article_number} — ${err.message}`,
      err,
    );
  }
}

// ─── Business logic handlers ──────────────────────────────────────────────────
// These run AFTER the event is already saved to DB.
// Add your own logic: push notifications, order updates, emails, COD flows, etc.

function _onItemBooked(payload) {
  logger.info(
    `📦 BOOKED — ${payload.article_number} | ` +
      `${payload.sender_address_city} → ${payload.destination_city} (${payload.destination_pincode}) | ` +
      `Weight: ${payload.weight_value}g | Tariff: ₹${payload.tariff}`,
  );
  // TODO: update your order management system
  // TODO: send booking confirmation to customer
}

function _onItemInTransit(payload) {
  logger.info(
    `🚚 IN TRANSIT — ${payload.article_number} | ` +
      `${payload.event_description} @ ${payload.event_office_name} | ${payload.event_date} ${payload.event_time}`,
  );
  // TODO: send "your package is on its way" notification
}

function _onItemDelivered(payload) {
  logger.info(
    `✅ DELIVERED — ${payload.article_number} | ` +
      `To: ${payload.receiver_name} @ ${payload.event_office_name} | ${payload.event_date} ${payload.event_time}`,
  );
  // TODO: mark order as delivered
  // TODO: send delivery confirmation to customer
  // TODO: trigger COD remittance flow if cod_amount > 0
}

function _onItemReturned(payload) {
  logger.warn(
    `↩️  RETURNED — ${payload.article_number} | ` +
      `Reason: ${payload.non_delivery_reason || "N/A"} | ${payload.event_date} ${payload.event_time}`,
  );
  // TODO: mark order as returned
  // TODO: notify merchant + customer
  // TODO: trigger refund flow
}

function _onDeliveryFailed(payload) {
  logger.warn(
    `❌ DELIVERY FAILED — ${payload.article_number} | ` +
      `Reason: ${payload.non_delivery_reason || "N/A"} | ${payload.event_date} ${payload.event_time}`,
  );
  // TODO: mark delivery attempt as failed
  // TODO: schedule re-delivery or notify customer
}

module.exports = router;
