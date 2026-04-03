const express = require("express");
const router = express.Router();
const pinCodeService = require("../services/pinCodeService");
const { asyncHandler } = require("../middleware/errorHandler");

/**
 * GET /pincode/search
 * Validate and search post offices by pincode.
 *
 * Query params: pincode (required), limit (optional, default 50)
 *
 * Example: GET /pincode/search?pincode=400001&limit=10
 */
router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const { pincode, limit } = req.query;

    if (!pincode) {
      return res.status(400).json({
        success: false,
        error: "pincode query parameter is required",
      });
    }

    const result = await pinCodeService.searchPinCode({
      pincode,
      limit: limit ? Number(limit) : 50,
    });

    res.json({ success: true, data: result });
  })
);

module.exports = router;
