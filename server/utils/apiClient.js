const axios = require("axios");
const axiosRetry = require("axios-retry").default;
const https = require("https");
const config = require("../config");
const logger = require("./logger");

// ─── HTTPS agent ──────────────────────────────────────────────────────────────
//
// test.cept.gov.in is a Government of India server that:
//   • Resets connections when Node's default TLS negotiation offers ciphers
//     or protocol versions it doesn't support.
//   • Rejects HTTP keep-alive (persistent connections cause ECONNRESET on
//     the second request on the same socket).
//   • Uses a certificate chain that may not be in Node's built-in CA store
//     (common for NIC-hosted .gov.in domains).
//
// Fixes applied:
//   1. keepAlive: false  — new TCP+TLS handshake per request; eliminates
//      ECONNRESET from reused sockets being closed server-side.
//   2. minVersion: "TLSv1.2", maxVersion: "TLSv1.2"  — pin to TLS 1.2;
//      the server does not support TLS 1.3.
//   3. ciphers  — prefer the AES-GCM / ECDHE suite that gov.in servers
//      typically negotiate, listed in OpenSSL priority order.
//   4. rejectUnauthorized: false  — NIC certificate chains are often
//      incomplete or use a root CA not in Node's bundle. Set to true
//      and supply a custom ca: buffer if you have the cert.

const httpsAgent = new https.Agent({
  keepAlive: false,
  minVersion: "TLSv1.2",
  maxVersion: "TLSv1.2",
  ciphers: [
    "ECDHE-RSA-AES128-GCM-SHA256",
    "ECDHE-RSA-AES256-GCM-SHA384",
    "ECDHE-RSA-AES128-SHA256",
    "ECDHE-RSA-AES256-SHA384",
    "AES128-GCM-SHA256",
    "AES256-GCM-SHA384",
    "AES128-SHA256",
    "AES256-SHA256",
  ].join(":"),
  rejectUnauthorized: false, // NIC/.gov.in certs often have incomplete chains
});

// ─── Axios instance ───────────────────────────────────────────────────────────

const apiClient = axios.create({
  baseURL: config.indiaPost.baseUrl,
  timeout: 30_000,
  httpsAgent,
  // Disable axios's own keep-alive header so the server doesn't think we
  // want a persistent connection.
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    Connection: "close",
  },
});

// ─── Retry logic ──────────────────────────────────────────────────────────────
//
// ECONNRESET is a network error — retry it, but NOT indefinitely.
// We do NOT retry on ECONNRESET after the first attempt has already received
// a response (i.e., error.response exists) because the server may have
// processed the request even though it closed the socket.

axiosRetry(apiClient, {
  retries: 2, // reduced from 3 — ECONNRESET loops aren't helpful if TLS is wrong
  retryDelay: (retryCount) => retryCount * 1000, // 1s, 2s
  retryCondition: (error) => {
    // Never retry if we got an actual HTTP response (server processed it)
    if (error.response) return false;

    const isNetworkError = axiosRetry.isNetworkError(error);
    const isTimeout =
      error.code === "ECONNABORTED" ||
      error.code === "ETIMEDOUT" ||
      error.code === "ECONNRESET";

    if (isNetworkError || isTimeout) {
      logger.warn(
        `Retrying [${error.config?.method?.toUpperCase()} ${error.config?.url}] — ${error.message}`
      );
      return true;
    }
    return false;
  },
});

// ─── Request interceptor ──────────────────────────────────────────────────────

apiClient.interceptors.request.use(
  (req) => {
    logger.debug(`→ ${req.method?.toUpperCase()} ${req.baseURL}${req.url}`);
    return req;
  },
  (error) => {
    logger.error(`Request setup error: ${error.message}`);
    return Promise.reject(error);
  }
);

// ─── Response interceptor ─────────────────────────────────────────────────────

apiClient.interceptors.response.use(
  (res) => {
    logger.debug(`← ${res.status} ${res.config.method?.toUpperCase()} ${res.config.url}`);
    return res;
  },
  (error) => {
    if (error.response) {
      logger.error(
        `← ${error.response.status} ${error.config?.method?.toUpperCase()} ${error.config?.url} | ${JSON.stringify(error.response.data)}`
      );
    } else {
      logger.error(`API Error (no response): ${error.message}`);
    }
    return Promise.reject(error);
  }
);

module.exports = apiClient;
