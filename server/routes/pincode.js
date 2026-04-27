const express = require("express");
const router = express.Router();
const { asyncHandler } = require("../middleware/errorHandler");
const { search } = require("../controllers/pinCodeController");

// GET /pincode/search?pincode=400001&limit=10
router.get("/search", asyncHandler(search));

module.exports = router;
