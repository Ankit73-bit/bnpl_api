const express = require("express");
const router = express.Router();
const { asyncHandler } = require("../middleware/errorHandler");
const { trackBulk, trackBulkAuto, downloadEvents } = require("../controllers/trackingController");

// POST /tracking/bulk         — up to 50 articles
router.post("/bulk",      asyncHandler(trackBulk));

// POST /tracking/bulk-auto    — any number of articles, auto-batched
router.post("/bulk-auto", asyncHandler(trackBulkAuto));

// POST /tracking/events       — event download for a date (returns XML)
router.post("/events",    asyncHandler(downloadEvents));

module.exports = router;
