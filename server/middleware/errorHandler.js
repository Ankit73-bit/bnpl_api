const logger = require("../utils/logger");
const authService = require("../services/authService");

/**
 * Central error handler middleware.
 * Catches all errors passed via next(err) or thrown in async routes.
 */
async function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const axiosResponse = err.response;

  // Handle 401 from India Post — force token refresh
  if (axiosResponse?.status === 401) {
    logger.warn("Received 401 from India Post — triggering force re-login.");
    try {
      await authService.forceRelogin();
    } catch (loginErr) {
      logger.error("Force re-login failed:", loginErr.message);
    }

    return res.status(401).json({
      success: false,
      error:
        'Authentication failed with India Post. Call POST /auth/login with "username" and "password", then retry your request.',
      retryable: true,
    });
  }

  // India Post API returned a structured error
  if (axiosResponse?.data) {
    logger.error(
      `India Post API error [${axiosResponse.status}]: ${JSON.stringify(axiosResponse.data)}`,
    );
    return res.status(axiosResponse.status || 502).json({
      success: false,
      error: "India Post API returned an error",
      details: axiosResponse.data,
    });
  }

  // Validation errors (thrown manually in services)
  if (status === 400 || err.message?.toLowerCase().includes("validation")) {
    logger.warn(`Validation error: ${err.message}`);
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }

  // Generic server error
  logger.error(`Unhandled error [${status}]: ${err.message}`, err);
  return res.status(status).json({
    success: false,
    error:
      process.env.NODE_ENV === "production"
        ? "An internal error occurred"
        : err.message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
}

/**
 * Wrap async route handlers to catch promise rejections automatically.
 * Usage: router.get('/path', asyncHandler(myAsyncFn))
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { errorHandler, asyncHandler };
