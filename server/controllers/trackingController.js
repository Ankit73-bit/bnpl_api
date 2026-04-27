const trackingService = require("../services/trackingService");

const MAX_BULK = 50;

/**
 * POST /tracking/bulk
 * Track up to 50 articles.
 * Body: { "articles": ["BARCODE1", ...] }
 */
async function trackBulk(req, res) {
  const { articles } = req.body;

  if (!articles || !Array.isArray(articles) || articles.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Body must contain a non-empty "articles" array of barcode strings',
    });
  }

  if (articles.length > MAX_BULK) {
    return res.status(400).json({
      success: false,
      error: `This endpoint supports up to ${MAX_BULK} articles. Use /tracking/bulk-auto for larger sets.`,
    });
  }

  const result = await trackingService.trackArticles(articles);
  res.json(result);
}

/**
 * POST /tracking/bulk-auto
 * Track any number of articles — auto-batches into groups of 50.
 * Body: { "articles": ["BARCODE1", ...] }
 */
async function trackBulkAuto(req, res) {
  const { articles } = req.body;

  if (!articles || !Array.isArray(articles) || articles.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Body must contain a non-empty "articles" array',
    });
  }

  const result = await trackingService.trackArticlesBatched(articles);
  res.json(result);
}

/**
 * POST /tracking/events
 * Download bulk event data for a customer + date as XML.
 * Body: { "custId": "0000000000", "eventCode": "LE", "eventDate": "01052024" }
 *
 * eventCode: LE = Last Event | IB = Item Booked | ID = Item Delivered | RT = Returned
 */
async function downloadEvents(req, res) {
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
}

module.exports = { trackBulk, trackBulkAuto, downloadEvents };
