const authService = require("../services/authService");

/**
 * POST /auth/login
 * Force a fresh login — supply { username, password } in the body.
 */
async function login(req, res) {
  const { username, password } = req.body || {};
  await authService.login({ username, password });
  res.json({ success: true, message: "Logged in successfully" });
}

/**
 * POST /auth/refresh
 * Manually trigger a token refresh.
 */
async function refresh(req, res) {
  const { username, password } = req.body || {};
  await authService.refreshAccessToken({ username, password });
  res.json({ success: true, message: "Token refreshed successfully" });
}

/**
 * GET /auth/status
 * Return the current token state (expiry, refresh expiry, etc.).
 */
async function status(req, res) {
  const tokenInfo = await authService.getTokenInfo();
  res.json({ success: true, tokenInfo });
}

module.exports = { login, refresh, status };
