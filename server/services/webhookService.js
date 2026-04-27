const logger = require("../utils/logger");
const { saveWebhookEvent } = require("./trackingService");

/**
 * Webhook Service
 *
 * Handles real-time India Post tracking events pushed via webhook.
 * Persists each event to MongoDB, then dispatches to the appropriate
 * business-logic handler based on the event code.
 *
 * All handlers run AFTER the HTTP 200 response has already been sent
 * (called via setImmediate from webhookController), so failures here
 * never affect India Post's delivery acknowledgement.
 */

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Process a single webhook payload from India Post.
 * Called asynchronously — errors are caught and logged, never thrown.
 *
 * @param {Object} payload - Raw webhook body from India Post
 */
async function processEvent(payload) {
  try {
    if (!payload || !payload.article_number) {
      logger.warn("Webhook: Received payload with no article_number — skipping");
      return;
    }

    const { article_number, event_code, event_description, event_office_name, event_date, event_time } =
      payload;

    logger.info(
      `Webhook ▶ ${article_number} | ${event_code} (${event_description}) | ${event_office_name} | ${event_date} ${event_time}`
    );

    // 1. Persist to MongoDB (TrackingEvent + upsert ArticleStatus)
    await saveWebhookEvent(payload);

    // 2. Dispatch to business-logic handler
    _dispatch(payload);
  } catch (err) {
    logger.error(
      `Webhook: Error processing event for ${payload?.article_number} — ${err.message}`,
      err
    );
  }
}

// ─── Event dispatcher ─────────────────────────────────────────────────────────

function _dispatch(payload) {
  switch (payload.event_code) {
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
        `Webhook: No handler for event code "${payload.event_code}" — event saved to DB.`
      );
  }
}

// ─── Business logic handlers ──────────────────────────────────────────────────
// These run after the event is already persisted to DB.
// Add your own logic: push notifications, order updates, emails, COD flows, etc.

function _onItemBooked(payload) {
  logger.info(
    `📦 BOOKED — ${payload.article_number} | ` +
      `${payload.sender_address_city} → ${payload.destination_city} (${payload.destination_pincode}) | ` +
      `Weight: ${payload.weight_value}g | Tariff: ₹${payload.tariff}`
  );
  // TODO: update your order management system
  // TODO: send booking confirmation to customer
}

function _onItemInTransit(payload) {
  logger.info(
    `🚚 IN TRANSIT — ${payload.article_number} | ` +
      `${payload.event_description} @ ${payload.event_office_name} | ${payload.event_date} ${payload.event_time}`
  );
  // TODO: send "your package is on its way" notification
}

function _onItemDelivered(payload) {
  logger.info(
    `✅ DELIVERED — ${payload.article_number} | ` +
      `To: ${payload.receiver_name} @ ${payload.event_office_name} | ${payload.event_date} ${payload.event_time}`
  );
  // TODO: mark order as delivered
  // TODO: send delivery confirmation to customer
  // TODO: trigger COD remittance flow if cod_amount > 0
}

function _onItemReturned(payload) {
  logger.warn(
    `↩️  RETURNED — ${payload.article_number} | ` +
      `Reason: ${payload.non_delivery_reason || "N/A"} | ${payload.event_date} ${payload.event_time}`
  );
  // TODO: mark order as returned
  // TODO: notify merchant + customer
  // TODO: trigger refund flow
}

function _onDeliveryFailed(payload) {
  logger.warn(
    `❌ DELIVERY FAILED — ${payload.article_number} | ` +
      `Reason: ${payload.non_delivery_reason || "N/A"} | ${payload.event_date} ${payload.event_time}`
  );
  // TODO: mark delivery attempt as failed
  // TODO: schedule re-delivery or notify customer
}

module.exports = { processEvent };
