const apiClient = require("../utils/apiClient");
const config = require("../config");
const logger = require("../utils/logger");
const { Token } = require("../models");

// ─── In-memory fallback cache ────────────────────────────────────────────────
// Avoids a DB round-trip on every single API call.
// The DB is the source of truth; this is just a per-process cache.
let _cache = null;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Login with username/password — fetches fresh access + refresh tokens.
 * Saves result to MongoDB and updates local cache.
 */
async function login({ username, password } = {}) {
  if (!username || !password) {
    const err = new Error(
      'Missing credentials. Provide "username" and "password" in request body.'
    );
    err.status = 400;
    throw err;
  }

  logger.info("Auth: Logging in to India Post API...");

  const response = await apiClient.post(config.indiaPost.endpoints.login, {
    username,
    password,
  });

  const { success, data } = response.data;

  if (!success || !data?.access_token) {
    throw new Error("Login failed: Invalid response from India Post auth API");
  }

  await _persistTokens(data);
  logger.info("Auth: Login successful. Token saved to DB.");
  return _cache.accessToken;
}

/**
 * Refresh the access token using the stored refresh token.
 * Falls back to full login if refresh token is expired or missing.
 */
async function refreshAccessToken({ username, password } = {}) {
  const tokenDoc = await _loadToken();

  if (!tokenDoc || !tokenDoc.refreshToken) {
    logger.warn("Auth: No refresh token in DB — performing full login.");
    return login({ username, password });
  }

  if (tokenDoc.isRefreshExpired) {
    logger.warn("Auth: Refresh token expired — performing full login.");
    return login({ username, password });
  }

  logger.info("Auth: Refreshing access token...");

  const response = await apiClient.post(
    config.indiaPost.endpoints.tokenRefresh,
    {},
    { headers: { Authorization: `Bearer ${tokenDoc.refreshToken}` } }
  );

  const data = response.data;

  if (!data?.access_token) {
    logger.warn("Auth: Token refresh returned unexpected data — re-logging in.");
    return login({ username, password });
  }

  // Refresh endpoint only returns a new access_token + expires_in
  const now = Date.now();
  const expiresAt = new Date(now + data.expires_in * 1000);

  await Token.findOneAndUpdate(
    { slot: "default" },
    { accessToken: data.access_token, expiresAt },
    { new: true }
  );

  // Update cache
  _cache = {
    accessToken: data.access_token,
    refreshToken: tokenDoc.refreshToken,
    expiresAt,
    refreshExpiresAt: tokenDoc.refreshExpiresAt,
  };

  logger.info("Auth: Access token refreshed and saved to DB.");
  return _cache.accessToken;
}

/**
 * Get a valid access token — auto-refreshes if close to expiry.
 * This is the main function called by all other services.
 */
async function getAccessToken() {
  // 1. Try in-memory cache first (fastest path)
  if (_cache && _cache.accessToken) {
    const bufferMs = config.token.refreshBuffer * 1000;
    if (Date.now() < _cache.expiresAt.getTime() - bufferMs) {
      return _cache.accessToken;
    }
    // Cache says token is expiring soon — fall through to refresh
    logger.debug("Auth: Cached token expiring soon — checking DB.");
  }

  // 2. Load from DB
  const tokenDoc = await _loadToken();

  if (!tokenDoc) {
    const err = new Error(
      'No token available. Call POST /auth/login with "username" and "password" first.'
    );
    err.status = 401;
    throw err;
  }

  const bufferMs = config.token.refreshBuffer * 1000;

  // 3. Token is still valid — update cache and return
  if (Date.now() < tokenDoc.expiresAt.getTime() - bufferMs) {
    _cache = {
      accessToken: tokenDoc.accessToken,
      refreshToken: tokenDoc.refreshToken,
      expiresAt: tokenDoc.expiresAt,
      refreshExpiresAt: tokenDoc.refreshExpiresAt,
    };
    return _cache.accessToken;
  }

  // 4. Token expiring soon — refresh it
  logger.debug("Auth: DB token expiring soon — refreshing.");
  return refreshAccessToken();
}

/**
 * Return token status info (for /auth/status endpoint).
 */
async function getTokenInfo() {
  const tokenDoc = await _loadToken();

  if (!tokenDoc) {
    return {
      hasToken: false,
      isExpired: true,
      expiresAt: null,
      refreshExpiresAt: null,
    };
  }

  return {
    hasToken: true,
    isExpired: new Date() >= tokenDoc.expiresAt,
    isExpiringSoon: tokenDoc.isExpiringSoon(config.token.refreshBuffer),
    expiresAt: tokenDoc.expiresAt.toISOString(),
    isRefreshExpired: tokenDoc.isRefreshExpired,
    refreshExpiresAt: tokenDoc.refreshExpiresAt.toISOString(),
    lastUpdated: tokenDoc.updatedAt?.toISOString() || null,
  };
}

/**
 * Force a full re-login — clears DB token and cache.
 * Called automatically by errorHandler on 401 responses.
 */
async function forceRelogin() {
  logger.warn("Auth: Force re-login triggered — clearing stored token.");
  await Token.deleteOne({ slot: "default" });
  _cache = null;
  throw new Error('Re-login credentials required. Call POST /auth/login with "username" and "password" first.');
}

// ─── Private helpers ─────────────────────────────────────────────────────────

/**
 * Load the token document from MongoDB.
 * Returns null if not found.
 */
async function _loadToken() {
  try {
    return await Token.findOne({ slot: "default" });
  } catch (err) {
    logger.error(`Auth: Failed to load token from DB — ${err.message}`);
    return null;
  }
}

/**
 * Save (upsert) new tokens to MongoDB and update in-memory cache.
 */
async function _persistTokens(data) {
  const now = Date.now();
  const expiresAt = new Date(now + data.expires_in * 1000);
  const refreshExpiresAt = new Date(now + data.refresh_expires_in * 1000);

  const tokenDoc = await Token.findOneAndUpdate(
    { slot: "default" },
    {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      idToken: data.id_token || null,
      expiresAt,
      refreshExpiresAt,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Update cache
  _cache = {
    accessToken: tokenDoc.accessToken,
    refreshToken: tokenDoc.refreshToken,
    expiresAt: tokenDoc.expiresAt,
    refreshExpiresAt: tokenDoc.refreshExpiresAt,
  };
}

module.exports = {
  login,
  refreshAccessToken,
  getAccessToken,
  getTokenInfo,
  forceRelogin,
};
