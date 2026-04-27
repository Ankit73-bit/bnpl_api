const express = require("express");
const router = express.Router();
const { asyncHandler } = require("../middleware/errorHandler");
const { getSpeedPostTariff, getBusinessParcelTariff } = require("../controllers/tariffController");

// GET /tariff/speed-post?weight=250&sourcePincode=400001&destinationPincode=110001&length=30&width=21&height=5&ins=1000&pod=YES
router.get("/speed-post",      asyncHandler(getSpeedPostTariff));

// GET /tariff/business-parcel?weight=550&sourcePincode=141010&destinationPincode=110057&length=10&width=5&height=2&ins=1000
router.get("/business-parcel", asyncHandler(getBusinessParcelTariff));

module.exports = router;
