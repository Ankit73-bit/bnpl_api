const express = require("express");
const router = express.Router();
const trackingService = require("../services/trackingService");
const { asyncHandler } = require("../middleware/errorHandler");

/**
 * POST /tracking/bulk
 * Track up to 50 articles in a single request.
 *
 * Body: { "articles": ["BARCODE1", "BARCODE2", ...] }
 */
router.post(
  "/bulk",
  asyncHandler(async (req, res) => {
    const { articles } = req.body;

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Body must contain a non-empty "articles" array of barcode strings',
      });
    }

    if (articles.length > 50) {
      return res.status(400).json({
        success: false,
        error: "This endpoint supports up to 50 articles. Use /tracking/bulk-auto for larger sets.",
      });
    }

    const result = await trackingService.trackArticles(articles);
    res.json(result);
  })
);

/**
 * POST /tracking/bulk-auto
 * Track any number of articles — auto-batches into groups of 50.
 *
 * Body: { "articles": ["BARCODE1", "BARCODE2", ...] }
 */
router.post(
  "/bulk-auto",
  asyncHandler(async (req, res) => {
    const { articles } = req.body;

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Body must contain a non-empty "articles" array',
      });
    }

    const result = await trackingService.trackArticlesBatched(articles);
    res.json(result);
  })
);

/**
 * POST /tracking/events
 * Download bulk event data for a specific date and customer.
 *
 * Body: { "custId": "0000000000", "eventCode": "LE", "eventDate": "01052024" }
 *
 * eventCode options:
 *   LE = Last Event
 *   IB = Item Booked
 *   ID = Item Delivered
 *   RT = Returned
 *
 * Returns: XML string
 */
router.post(
  "/events",
  asyncHandler(async (req, res) => {
    const { custId, eventCode, eventDate } = req.body;

    if (!custId || !eventCode || !eventDate) {
      return res.status(400).json({
        success: false,
        error: "Required fields: custId, eventCode (LE/IB/ID/RT), eventDate (DDMMYYYY)",
      });
    }

    const xmlData = await trackingService.downloadEvents({ custId, eventCode, eventDate });

    res.setHeader("Content-Type", "application/xml");
    res.send(xmlData);
  })
);

module.exports = router;
