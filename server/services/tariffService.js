const apiClient = require("../utils/apiClient");
const config = require("../config");
const authService = require("./authService");
const logger = require("../utils/logger");
const { TariffLog } = require("../models");

/**
 * Calculate tariff for Speed Post articles.
 * Logs the request and result to MongoDB.
 */
async function getSpeedPostTariff(params) {
  const token = await authService.getAccessToken();
  const { weight, sourcePincode, destinationPincode, length, width, height, ins, pod } = params;

  logger.info(`Tariff: Speed Post — ${sourcePincode} → ${destinationPincode}, weight: ${weight}g`);

  const queryParams = {
    "product-code": "SP",
    weight,
    sourcepincode: sourcePincode,
    destinationpincode: destinationPincode,
    length,
    width,
    height,
  };
  if (ins !== undefined) queryParams.INS = ins;
  if (pod !== undefined) queryParams.POD = pod;

  try {
    const response = await apiClient.get(
      config.indiaPost.endpoints.speedPostTariff,
      { params: queryParams, headers: { Authorization: `Bearer ${token}` } }
    );

    const data = response.data;

    // Save to DB (non-blocking)
    TariffLog.create({
      productType: "SP",
      weight, sourcePincode, destinationPincode, length, width, height,
      insValue: ins ?? null,
      pod: pod ?? null,
      chargeableWeight: data.chargeable_weight ?? null,
      volumetricWeight: data.volumetric_weight ?? null,
      distanceKm: data.distance ?? null,
      baseTariff: data.base_tariff ?? null,
      insuranceCharge: data.insurance_charge ?? null,
      podCharge: data.pod_charge ?? null,
      cgst: data.cgst ?? null,
      sgst: data.sgst ?? null,
      igst: data.igst ?? null,
      totalTax: data.gst ?? null,
      totalWithTax: data.total_with_tax ?? null,
      rawResponse: data,
      success: true,
    }).catch((err) => logger.warn(`TariffLog save failed: ${err.message}`));

    return data;
  } catch (err) {
    // Log the failure too
    TariffLog.create({
      productType: "SP",
      weight, sourcePincode, destinationPincode, length, width, height,
      insValue: ins ?? null,
      pod: pod ?? null,
      success: false,
      errorMessage: err.message,
    }).catch(() => {});
    throw err;
  }
}

/**
 * Calculate tariff for Business Parcel articles.
 * Logs the request and result to MongoDB.
 */
async function getBusinessParcelTariff(params) {
  const token = await authService.getAccessToken();
  const { weight, sourcePincode, destinationPincode, length, width, height, ins } = params;

  logger.info(`Tariff: Business Parcel — ${sourcePincode} → ${destinationPincode}, weight: ${weight}g`);

  const queryParams = {
    "product-code": "BP",
    weight,
    sourcepincode: sourcePincode,
    destinationpincode: destinationPincode,
    length,
    width,
    height,
  };
  if (ins !== undefined) queryParams.ins = ins;

  try {
    const response = await apiClient.get(
      config.indiaPost.endpoints.businessParcelTariff,
      { params: queryParams, headers: { Authorization: `Bearer ${token}` } }
    );

    const data = response.data;

    TariffLog.create({
      productType: "BP",
      weight, sourcePincode, destinationPincode, length, width, height,
      insValue: ins ?? null,
      chargeableWeight: data.chargeable_weight ?? null,
      volumetricWeight: null,
      distanceKm: data.distance_km ?? null,
      baseTariff: data.base_tariff ?? null,
      cgst: data.cgst ?? null,
      sgst: data.sgst ?? null,
      totalTax: data.total_tax ?? null,
      totalWithTax: data.final_amount ?? null,
      rawResponse: data,
      success: true,
    }).catch((err) => logger.warn(`TariffLog save failed: ${err.message}`));

    return data;
  } catch (err) {
    TariffLog.create({
      productType: "BP",
      weight, sourcePincode, destinationPincode, length, width, height,
      insValue: ins ?? null,
      success: false,
      errorMessage: err.message,
    }).catch(() => {});
    throw err;
  }
}

module.exports = { getSpeedPostTariff, getBusinessParcelTariff };
