const express = require("express");
const router = express.Router();
const { asyncHandler } = require("../middleware/errorHandler");
const { generateDomestic } = require("../controllers/labelController");

// POST /label/domestic — returns PDF binary
router.post("/domestic", asyncHandler(generateDomestic));

module.exports = router;
