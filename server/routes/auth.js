const express = require("express");
const router = express.Router();
const { asyncHandler } = require("../middleware/errorHandler");
const { login, refresh, status } = require("../controllers/authController");

router.post("/login",   asyncHandler(login));
router.post("/refresh", asyncHandler(refresh));
router.get("/status",   asyncHandler(status));

module.exports = router;
