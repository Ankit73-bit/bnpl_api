const pinCodeService = require("../services/pinCodeService");

/**
 * GET /pincode/search
 * Query params: pincode (required), limit (optional, default 50)
 */
async function search(req, res) {
  const { pincode, limit } = req.query;

  if (!pincode) {
    return res.status(400).json({
      success: false,
      error: "Query param 'pincode' is required",
    });
  }

  const data = await pinCodeService.searchPinCode({
    pincode,
    limit: limit ? Number(limit) : 50,
  });

  res.json({ success: true, data });
}

module.exports = { search };
