const express = require("express");
const router = express.Router();
const tariffService = require("../services/tariffService");
const { asyncHandler } = require("../middleware/errorHandler");

/**
 * GET /tariff/speed-post
 * Calculate Speed Post tariff.
 *
 * Query params: weight, sourcePincode, destinationPincode, length, width, height, ins, pod
 *
 * Example:
 *   GET /tariff/speed-post?weight=250&sourcePincode=400001&destinationPincode=110001
 *                         &length=30&width=21&height=5&ins=1000&pod=YES
 */
router.get(
  "/speed-post",
  asyncHandler(async (req, res) => {
    const {
      weight,
      sourcePincode,
      destinationPincode,
      length,
      width,
      height,
      ins,
      pod,
    } = req.query;

    if (!weight || !sourcePincode || !destinationPincode || !length || !width || !height) {
      return res.status(400).json({
        success: false,
        error: "Required: weight, sourcePincode, destinationPincode, length, width, height",
      });
    }

    const result = await tariffService.getSpeedPostTariff({
      weight: Number(weight),
      sourcePincode,
      destinationPincode,
      length: Number(length),
      width: Number(width),
      height: Number(height),
      ins: ins !== undefined ? Number(ins) : undefined,
      pod,
    });

    res.json({ success: true, data: result });
  })
);

/**
 * GET /tariff/business-parcel
 * Calculate Business Parcel tariff.
 *
 * Query params: weight, sourcePincode, destinationPincode, length, width, height, ins
 */
router.get(
  "/business-parcel",
  asyncHandler(async (req, res) => {
    const { weight, sourcePincode, destinationPincode, length, width, height, ins } =
      req.query;

    if (!weight || !sourcePincode || !destinationPincode || !length || !width || !height) {
      return res.status(400).json({
        success: false,
        error: "Required: weight, sourcePincode, destinationPincode, length, width, height",
      });
    }

    const result = await tariffService.getBusinessParcelTariff({
      weight: Number(weight),
      sourcePincode,
      destinationPincode,
      length: Number(length),
      width: Number(width),
      height: Number(height),
      ins: ins !== undefined ? Number(ins) : undefined,
    });

    res.json({ success: true, data: result });
  })
);

module.exports = router;
