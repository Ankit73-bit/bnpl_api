const apiClient = require("../utils/apiClient");
const config = require("../config");
const authService = require("./authService");
const logger = require("../utils/logger");

/**
 * Generate a domestic address label (PDF) for a booked article.
 *
 * Required fields (per API spec):
 *   channelType, userType, barcodeNo, serviceType, bookingType,
 *   articleLength, articleBreadth, articleHeight,
 *   recipientName, recipientAddressl1, recipientAddressl2, recipientAddressl3
 *
 * @param {Object} labelData - Full label generation payload
 * @returns {Buffer}          - PDF binary content
 */
async function generateDomesticLabel(labelData) {
  _validateLabelData(labelData);

  const token = await authService.getAccessToken();

  logger.info(
    `Label: Generating domestic label for barcode: ${labelData.barcode_no || labelData.barcodeNo}`
  );

  const response = await apiClient.post(
    config.indiaPost.endpoints.addressLabel,
    labelData,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/pdf",
      },
      responseType: "arraybuffer", // PDF comes back as binary
    }
  );

  return response.data; // Returns PDF Buffer
}

// ─── Validation ─────────────────────────────────────────────────────────────

const VALID_CHANNEL_TYPES = ["I", "E", "K", "M"];
const VALID_USER_TYPES = ["G", "D", "A", "T"];

function _validateLabelData(data) {
  const errors = [];

  if (!data.channel_type && !data.channelType) {
    errors.push("channel_type is required");
  } else {
    const ct = data.channel_type || data.channelType;
    if (!VALID_CHANNEL_TYPES.includes(ct)) {
      errors.push(`channel_type must be one of: ${VALID_CHANNEL_TYPES.join(", ")}`);
    }
  }

  if (!data.user_type && !data.userType) {
    errors.push("user_type is required");
  } else {
    const ut = data.user_type || data.userType;
    if (!VALID_USER_TYPES.includes(ut)) {
      errors.push(`user_type must be one of: ${VALID_USER_TYPES.join(", ")}`);
    }
  }

  const requiredFields = [
    ["barcode_no", "barcodeNo"],
    ["service_type", "serviceType"],
    ["booking_type", "bookingType"],
    ["article_length", "articleLength"],
    ["article_breadth", "articleBreadth"],
    ["article_height", "articleHeight"],
    ["recipient_name", "recipientName"],
    ["recipient_addressl1", "recipientAddressl1"],
    ["recipient_addressl2", "recipientAddressl2"],
    ["recipient_addressl3", "recipientAddressl3"],
  ];

  for (const [snakeKey, camelKey] of requiredFields) {
    if (!data[snakeKey] && !data[camelKey]) {
      errors.push(`${snakeKey} is required`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Label validation failed:\n  - ${errors.join("\n  - ")}`);
  }
}

module.exports = { generateDomesticLabel };
