const logger = require("../utils/logger");
const webhookService = require("../services/webhookService");

/**
 * POST /webhook/events
 * India Post pushes real-time tracking events here.
 *
 * Setup: Self Service Portal → Settings → Master Configuration
 *        → Event Configuration → Webhook → enter URL + static IP
 *
 * Strategy: respond with 200 immediately, then process asynchronously.
 * India Post expects a fast acknowledgement — processing must not block it.
 */
async function receiveEvent(req, res) {
  // Acknowledge immediately — India Post requires a fast 200
  res.status(200).json({ received: true });

  // Process after response is sent
  setImmediate(() => webhookService.processEvent(req.body));
}

/**
 * GET /webhook/events
 * Reachability check — confirms the webhook URL is live.
 */
function healthCheck(req, res) {
  res.json({
    success: true,
    message: "India Post webhook endpoint is active",
    timestamp: new Date().toISOString(),
  });
}

module.exports = { receiveEvent, healthCheck };
