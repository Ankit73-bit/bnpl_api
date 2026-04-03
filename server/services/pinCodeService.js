const apiClient = require("../utils/apiClient");
const config = require("../config");
const authService = require("./authService");
const logger = require("../utils/logger");

/**
 * Search and validate a pincode, returning post office details.
 *
 * @param {Object} params
 * @param {string|number} params.pincode   - 6-digit pincode (required)
 * @param {number}        [params.limit]   - Max results to return (default 50)
 */
async function searchPinCode({ pincode, limit = 50 }) {
  if (!pincode || String(pincode).length !== 6) {
    throw new Error("Invalid pincode: must be exactly 6 digits");
  }

  const token = await authService.getAccessToken();

  logger.info(`PinCode: Searching offices for pincode ${pincode}`);

  const response = await apiClient.get(
    config.indiaPost.endpoints.pinCodeSearch,
    {
      params: {
        pincode,
        limit,
        "office-type": "post",
      },
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  return response.data;
}

module.exports = { searchPinCode };
