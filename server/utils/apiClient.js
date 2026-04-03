const axios = require("axios");
const axiosRetry = require("axios-retry").default;
const config = require("../config");
const logger = require("./logger");

// Create the base axios instance
const apiClient = axios.create({
  baseURL: config.indiaPost.baseUrl,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Attach retry logic: 3 retries on network errors or 5xx responses
axiosRetry(apiClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    const isNetworkError = axiosRetry.isNetworkError(error);
    const isServerError = error.response && error.response.status >= 500;
    const isTimeout =
      error.code === "ECONNABORTED" || error.code === "ETIMEDOUT";

    if (isNetworkError || isServerError || isTimeout) {
      logger.warn(
        `Retrying request [${error.config?.method?.toUpperCase()} ${error.config?.url}] — reason: ${
          error.message
        }`,
      );
      return true;
    }
    return false;
  },
});

// Request interceptor — log outgoing calls
apiClient.interceptors.request.use(
  (req) => {
    logger.debug(`→ ${req.method?.toUpperCase()} ${req.baseURL}${req.url}`);
    return req;
  },
  (error) => {
    logger.error("Request setup error:", error.message);
    return Promise.reject(error);
  },
);

// Response interceptor — log responses and normalize errors
apiClient.interceptors.response.use(
  (res) => {
    logger.debug(
      `← ${res.status} ${res.config.method?.toUpperCase()} ${res.config.url}`,
    );
    return res;
  },
  (error) => {
    if (error.response) {
      logger.error(
        `← ${error.response.status} ${error.config?.method?.toUpperCase()} ${error.config?.url} | ${JSON.stringify(
          error.response.data,
        )}`,
      );
    } else {
      logger.error(`API Error (no response): ${error.message}`);
    }
    return Promise.reject(error);
  },
);

module.exports = apiClient;
