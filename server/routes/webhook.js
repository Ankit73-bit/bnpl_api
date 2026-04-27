const express = require("express");
const router = express.Router();
const { asyncHandler } = require("../middleware/errorHandler");
const { receiveEvent, healthCheck } = require("../controllers/webhookController");

// POST /webhook/events — India Post pushes real-time events here
router.post("/events", asyncHandler(receiveEvent));

// GET  /webhook/events — reachability / health check
router.get("/events",  healthCheck);

module.exports = router;
