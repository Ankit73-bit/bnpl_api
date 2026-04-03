const express = require("express");
const router = express.Router();
const authService = require("../services/authService");
const { asyncHandler } = require("../middleware/errorHandler");

/**
 * POST /auth/login
 * Force a fresh login (useful for testing)
 */
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    await authService.login({ username, password });
    res.json({ success: true, message: "Logged in successfully" });
  })
);

/**
 * POST /auth/refresh
 * Manually trigger a token refresh
 */
router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    await authService.refreshAccessToken({ username, password });
    res.json({ success: true, message: "Token refreshed successfully" });
  })
);

/**
 * GET /auth/status
 * Check current token state
 */
router.get(
  "/status",
  asyncHandler(async (req, res) => {
    const info = authService.getTokenInfo();
    res.json({ success: true, tokenInfo: info });
  })
);

module.exports = router;
