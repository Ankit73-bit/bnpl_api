const FormData = require("form-data");
const fs = require("fs");
const apiClient = require("../utils/apiClient");
const config = require("../config");
const authService = require("./authService");
const logger = require("../utils/logger");
const { Booking } = require("../models");

/**
 * Book articles via JSON payload (up to 1,000 articles).
 * Saves the booking request and India Post response to MongoDB.
 */
async function bookArticlesJson(customId, articles) {
  if (!customId) throw new Error("customId is required");
  if (!Array.isArray(articles) || articles.length === 0) {
    throw new Error("articles must be a non-empty array");
  }
  if (articles.length > 1000) {
    throw new Error(
      "JSON endpoint supports up to 1,000 articles. Use bookArticlesFile() for larger batches."
    );
  }

  const token = await authService.getAccessToken();
  logger.info(`Booking: JSON — customId: ${customId}, articles: ${articles.length}`);

  // Create a pending DB record before calling India Post
  const bookingDoc = await Booking.create({
    customId: String(customId),
    contractId: String(articles[0]?.contract_id || ""),
    inputMethod: "json_body",
    totalArticles: articles.length,
    status: "pending",
    articleInputs: articles.map(_mapArticleInput),
  });

  try {
    const url = `${config.indiaPost.endpoints.bulkBookingJson}/${customId}`;
    const response = await apiClient.post(
      url,
      { articles },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const result = response.data;
    await _updateBookingFromResponse(bookingDoc, result);

    logger.info(
      `Booking: Saved — id: ${bookingDoc._id} | success: ${result.summary?.success_count} | errors: ${result.summary?.error_count}`
    );

    return result;
  } catch (err) {
    await Booking.findByIdAndUpdate(bookingDoc._id, { status: "failed" });
    throw err;
  }
}

/**
 * Book articles via file path on disk (up to 5,000 articles).
 */
async function bookArticlesFile(customId, filePath) {
  if (!customId) throw new Error("customId is required");
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const token = await authService.getAccessToken();
  logger.info(`Booking: File upload — customId: ${customId}, file: ${filePath}`);

  const bookingDoc = await Booking.create({
    customId: String(customId),
    inputMethod: "file_upload",
    status: "pending",
  });

  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), {
      filename: "articles.json",
      contentType: "application/json",
    });

    const url = `${config.indiaPost.endpoints.bulkBookingFile}/${customId}`;
    const response = await apiClient.post(url, form, {
      headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() },
    });

    const result = response.data;
    await _updateBookingFromResponse(bookingDoc, result);
    return result;
  } catch (err) {
    await Booking.findByIdAndUpdate(bookingDoc._id, { status: "failed" });
    throw err;
  }
}

/**
 * Book articles via in-memory buffer (multer upload).
 */
async function bookArticlesBuffer(customId, fileBuffer, filename = "articles.json") {
  if (!customId) throw new Error("customId is required");
  if (!fileBuffer) throw new Error("fileBuffer is required");

  const token = await authService.getAccessToken();
  logger.info(`Booking: Buffer upload — customId: ${customId}, size: ${fileBuffer.length} bytes`);

  // Try to extract article inputs from buffer for the DB record
  let articleInputs = [];
  try {
    const parsed = JSON.parse(fileBuffer.toString("utf8"));
    if (Array.isArray(parsed?.articles)) {
      articleInputs = parsed.articles.map(_mapArticleInput);
    }
  } catch (_) { /* not a blocking error */ }

  const bookingDoc = await Booking.create({
    customId: String(customId),
    inputMethod: "file_upload",
    totalArticles: articleInputs.length,
    status: "pending",
    articleInputs,
  });

  try {
    const form = new FormData();
    form.append("file", fileBuffer, { filename, contentType: "application/json" });

    const url = `${config.indiaPost.endpoints.bulkBookingFile}/${customId}`;
    const response = await apiClient.post(url, form, {
      headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() },
    });

    const result = response.data;
    await _updateBookingFromResponse(bookingDoc, result);

    logger.info(`Booking: Saved — id: ${bookingDoc._id}`);
    return result;
  } catch (err) {
    await Booking.findByIdAndUpdate(bookingDoc._id, { status: "failed" });
    throw err;
  }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

async function _updateBookingFromResponse(bookingDoc, result) {
  const summary = result.summary || {};
  const successCount = summary.success_count ?? 0;
  const errorCount = summary.error_count ?? 0;

  const status =
    errorCount === 0   ? "submitted" :
    successCount === 0 ? "failed"    :
                         "partial";

  await Booking.findByIdAndUpdate(bookingDoc._id, {
    batchId:          result.batch_id || null,
    mailBookingDomId: result.mail_booking_dom_id ? String(result.mail_booking_dom_id) : null,
    correlationId:    result.correlation_id || null,
    processed:        result.processed ?? 0,
    successCount,
    errorCount,
    totalTariffAmount: summary.total_tariff_amount ?? 0,
    status,
    indiaPostTimestamp: result.timestamp ? new Date(result.timestamp) : null,
    rawResponse: result,
    validArticles: (result.valid_articles || []).map((a) => ({
      barcodeNo:        a.barcode_no,
      index:            a.index,
      timestamp:        a.timestamp ? new Date(a.timestamp) : null,
      offsetNumber:     a.offset_number || null,
      blockNumber:      a.block_number || null,
      calculatedTariff: a.calculated_tariff || null,
      currency:         a.currency || "INR",
      validationErrors: [],
    })),
    errorArticles: (result.error_articles || []).map((a) => ({
      barcodeNo:        a.barcode_no,
      index:            a.index,
      timestamp:        a.timestamp ? new Date(a.timestamp) : null,
      offsetNumber:     null,
      blockNumber:      null,
      calculatedTariff: null,
      validationErrors: a.errors || [],
    })),
  });
}

function _mapArticleInput(article) {
  return {
    barcodeNo:       article.barcode_no || null,
    articleType:     article.article_type || null,
    physicalWeight:  article.physical_weight || null,
    senderName:      article.sender_name || null,
    senderPincode:   String(article.sender_pincode || ""),
    senderCity:      article.sender_city || null,
    receiverName:    article.receiver_name || null,
    receiverPincode: String(article.receiver_pincode || ""),
    receiverCity:    article.receiver_city || null,
    pickupOrDropoff: article.pickup_or_dropoff || null,
    dropOffPincode:  String(article.drop_off_pincode || ""),
    bulkReference:   article.bulk_reference || null,
  };
}

module.exports = {
  bookArticlesJson,
  bookArticlesFile,
  bookArticlesBuffer,
};
