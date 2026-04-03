const apiClient = require("../utils/apiClient");
const config = require("../config");
const authService = require("./authService");
const logger = require("../utils/logger");
const { TrackingEvent, ArticleStatus } = require("../models");

const MAX_ARTICLES_PER_REQUEST = 50;

/**
 * Track up to 50 articles. Saves results to TrackingEvent + ArticleStatus.
 */
async function trackArticles(articleNumbers) {
  if (!Array.isArray(articleNumbers) || articleNumbers.length === 0) {
    throw new Error("articleNumbers must be a non-empty array");
  }
  if (articleNumbers.length > MAX_ARTICLES_PER_REQUEST) {
    throw new Error(
      `Bulk tracking supports up to ${MAX_ARTICLES_PER_REQUEST} articles per call. ` +
        `Received: ${articleNumbers.length}. Use trackArticlesBatched() for larger sets.`
    );
  }

  const token = await authService.getAccessToken();
  logger.info(`Tracking: ${articleNumbers.length} article(s)`);

  const response = await apiClient.post(
    config.indiaPost.endpoints.bulkTracking,
    { bulk: articleNumbers },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const result = response.data;

  // Save tracking data to DB (non-blocking)
  if (result?.data && Array.isArray(result.data)) {
    _persistTrackingResults(result.data, "tracking_api").catch((err) =>
      logger.warn(`Tracking DB save failed: ${err.message}`)
    );
  }

  return result;
}

/**
 * Track any number of articles — auto-batches into groups of 50.
 */
async function trackArticlesBatched(articleNumbers) {
  if (!Array.isArray(articleNumbers) || articleNumbers.length === 0) {
    throw new Error("articleNumbers must be a non-empty array");
  }

  const batches = _chunkArray(articleNumbers, MAX_ARTICLES_PER_REQUEST);
  logger.info(`Tracking: ${articleNumbers.length} articles split into ${batches.length} batch(es)`);

  const results = [];

  for (let i = 0; i < batches.length; i++) {
    logger.debug(`Tracking: Processing batch ${i + 1}/${batches.length}`);
    const batchResult = await trackArticles(batches[i]);

    if (batchResult?.data && Array.isArray(batchResult.data)) {
      results.push(...batchResult.data);
    }
  }

  return { success: true, total: articleNumbers.length, data: results };
}

/**
 * Download bulk event data for a specific date and customer (XML response).
 */
async function downloadEvents({ custId, eventCode, eventDate }) {
  _validateEventParams({ custId, eventCode, eventDate });

  const token = await authService.getAccessToken();
  logger.info(`Events: Downloading — custId: ${custId}, code: ${eventCode}, date: ${eventDate}`);

  const response = await apiClient.post(
    config.indiaPost.endpoints.eventDownload,
    { Cust_Id: custId, Event_Code: eventCode, Event_Date: eventDate },
    {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/xml" },
      responseType: "text",
    }
  );

  return response.data;
}

// ─── DB persistence ───────────────────────────────────────────────────────────

/**
 * For each article in a tracking API response, save each tracking event
 * and upsert the current ArticleStatus.
 */
async function _persistTrackingResults(articleDataArray, source = "tracking_api") {
  for (const articleData of articleDataArray) {
    const { booking_details, tracking_details, del_status } = articleData;
    const articleNumber = booking_details?.article_number;

    if (!articleNumber) continue;

    // Save each tracking event
    if (Array.isArray(tracking_details)) {
      const eventDocs = tracking_details.map((evt) => ({
        articleNumber,
        articleType: booking_details.article_type || null,
        eventCode: evt.event || "UNKNOWN",
        eventDescription: evt.event || null,
        eventDate: evt.date ? evt.date.split("T")[0] : null,
        eventTime: evt.time || null,
        eventDateTime: _parseEventDateTime(evt.date, evt.time),
        eventOfficeFacilityId: String(evt.officeid || ""),
        eventOfficeName: evt.office || null,
        destinationPincode: booking_details.destination_pincode
          ? Number(booking_details.destination_pincode)
          : null,
        tariff: booking_details.tariff || null,
        source,
      }));

      // Use insertMany with ordered:false — skips duplicates gracefully
      if (eventDocs.length > 0) {
        await TrackingEvent.insertMany(eventDocs, { ordered: false }).catch(() => {});
      }
    }

    // Upsert the current article status
    const latestEvent = tracking_details?.[tracking_details.length - 1];
    await _upsertArticleStatus(articleNumber, booking_details, del_status, latestEvent);
  }
}

/**
 * Upsert the ArticleStatus document for one article.
 */
async function _upsertArticleStatus(articleNumber, bookingDetails, delStatus, latestEvent) {
  const deliveryStatus = _mapDeliveryStatus(
    delStatus?.del_status,
    latestEvent?.event
  );

  const update = {
    articleType: bookingDetails?.article_type || null,
    deliveryStatus,
    latestEventCode: latestEvent?.event || null,
    latestEventDescription: latestEvent?.event || null,
    latestEventOfficeName: latestEvent?.office || null,
    latestEventDateTime: _parseEventDateTime(latestEvent?.date, latestEvent?.time),
    destinationPincode: bookingDetails?.destination_pincode
      ? Number(bookingDetails.destination_pincode)
      : null,
    tariff: bookingDetails?.tariff || null,
    $inc: { eventCount: 0 }, // keep count updated via webhook instead
  };

  if (deliveryStatus === "delivered") {
    update.deliveredAt = _parseEventDateTime(latestEvent?.date, latestEvent?.time);
    update.deliveryOfficeName = latestEvent?.office || null;
  }

  await ArticleStatus.findOneAndUpdate(
    { articleNumber },
    { $set: update },
    { upsert: true, new: true }
  );
}

// ─── Shared helpers (also exported for webhook use) ──────────────────────────

/**
 * Save a single webhook event payload to TrackingEvent + upsert ArticleStatus.
 */
async function saveWebhookEvent(payload) {
  const {
    article_number,
    article_type,
    event_code,
    event_description,
    event_date,
    event_time,
    event_office_facility_id,
    event_office_name,
    booking_ref_id,
    booking_date,
    booking_time,
    booking_office_facility_id,
    booking_office_name,
    booking_pin,
    sender_address_city,
    destination_office_facility_id,
    destination_office_name,
    destination_pincode,
    destination_city,
    destination_country,
    receiver_name,
    invoice_no,
    line_item,
    weight_value,
    tariff,
    cod_amount,
    booking_type,
    contract_number,
    reference,
    bulk_customer_id,
    non_delivery_reason,
  } = payload;

  const eventDateTime = _parseEventDateTime(event_date, event_time);

  // 1. Save the event
  await TrackingEvent.create({
    articleNumber: article_number,
    articleType: article_type || null,
    eventCode: event_code,
    eventDescription: event_description || null,
    eventDate: event_date || null,
    eventTime: event_time || null,
    eventDateTime,
    eventOfficeFacilityId: String(event_office_facility_id || ""),
    eventOfficeName: event_office_name || null,
    bookingRefId: booking_ref_id ? String(booking_ref_id) : null,
    bookingDate: booking_date || null,
    bookingTime: booking_time || null,
    bookingOfficeFacilityId: booking_office_facility_id
      ? String(booking_office_facility_id)
      : null,
    bookingOfficeName: booking_office_name || null,
    bookingPin: booking_pin || null,
    senderAddressCity: sender_address_city || null,
    destinationOfficeFacilityId: destination_office_facility_id || null,
    destinationOfficeName: destination_office_name || null,
    destinationPincode: destination_pincode || null,
    destinationCity: destination_city || null,
    destinationCountry: destination_country || null,
    receiverName: receiver_name || null,
    invoiceNo: invoice_no || null,
    lineItem: line_item ? String(line_item) : null,
    weightValue: weight_value || null,
    tariff: tariff || null,
    codAmount: cod_amount || null,
    bookingType: booking_type || null,
    contractNumber: contract_number || null,
    reference: reference || null,
    bulkCustomerId: bulk_customer_id || null,
    nonDeliveryReason: non_delivery_reason || null,
    source: "webhook",
  });

  // 2. Upsert ArticleStatus
  const deliveryStatus = _mapDeliveryStatus(null, event_code);

  const statusUpdate = {
    articleType: article_type || null,
    deliveryStatus,
    latestEventCode: event_code,
    latestEventDescription: event_description || null,
    latestEventOfficeName: event_office_name || null,
    latestEventDateTime: eventDateTime,
    bookingRefId: booking_ref_id ? String(booking_ref_id) : null,
    bookingDate: booking_date || null,
    bookingOfficeName: booking_office_name || null,
    bookingPin: booking_pin || null,
    senderCity: sender_address_city || null,
    destinationOfficeName: destination_office_name || null,
    destinationPincode: destination_pincode || null,
    destinationCity: destination_city || null,
    receiverName: receiver_name || null,
    tariff: tariff || null,
    weightValue: weight_value || null,
    codAmount: cod_amount || 0,
    bulkCustomerId: bulk_customer_id || null,
    contractNumber: contract_number || null,
    reference: reference || null,
    nonDeliveryReason: non_delivery_reason || null,
    $inc: { eventCount: 1 },
  };

  if (deliveryStatus === "delivered") {
    statusUpdate.deliveredAt = eventDateTime;
    statusUpdate.deliveryOfficeName = event_office_name || null;
  }
  if (deliveryStatus === "returned") {
    statusUpdate.returnedAt = eventDateTime;
  }

  await ArticleStatus.findOneAndUpdate(
    { articleNumber: article_number },
    { $set: { ...statusUpdate, $inc: undefined }, $inc: { eventCount: 1 } },
    { upsert: true, new: true }
  );

  logger.debug(`Tracking DB: Saved event ${event_code} for ${article_number}`);
}

// ─── Private helpers ─────────────────────────────────────────────────────────

const DELIVERY_STATUS_MAP = {
  ITEM_BOOK: "booked",
  ITEM_BAGGED: "in_transit",
  BAG_CLOSE: "in_transit",
  ITEM_DISPATCHED: "in_transit",
  ITEM_RECEIVED: "in_transit",
  ITEM_INVOICED: "out_for_delivery",
  ITEM_DELIVERED: "delivered",
  ITEM_NOT_DELIVERED: "failed_delivery",
  ITEM_RETURNED: "returned",
  RTS: "returned",
};

function _mapDeliveryStatus(delStatusStr, eventCode) {
  if (delStatusStr === "delivered") return "delivered";
  if (delStatusStr === "returned") return "returned";
  return DELIVERY_STATUS_MAP[eventCode] || "in_transit";
}

function _parseEventDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  try {
    const datePart = dateStr.includes("T")
      ? dateStr.split("T")[0]
      : dateStr;
    return timeStr
      ? new Date(`${datePart}T${timeStr}`)
      : new Date(datePart);
  } catch {
    return null;
  }
}

const VALID_EVENT_CODES = ["LE", "IB", "ID", "RT"];

function _validateEventParams({ custId, eventCode, eventDate }) {
  const errors = [];
  if (!custId || String(custId).length !== 10)
    errors.push("custId must be exactly 10 characters");
  if (!eventCode || !VALID_EVENT_CODES.includes(eventCode))
    errors.push(`eventCode must be one of: ${VALID_EVENT_CODES.join(", ")}`);
  if (!eventDate || !/^\d{8}$/.test(eventDate))
    errors.push("eventDate must be in DDMMYYYY format (e.g., 01052024)");
  if (errors.length > 0)
    throw new Error(`Event params validation failed:\n  - ${errors.join("\n  - ")}`);
}

function _chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

module.exports = {
  trackArticles,
  trackArticlesBatched,
  downloadEvents,
  saveWebhookEvent,
};
