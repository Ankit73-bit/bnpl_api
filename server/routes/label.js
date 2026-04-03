const express = require("express");
const router = express.Router();
const labelService = require("../services/labelService");
const { asyncHandler } = require("../middleware/errorHandler");

/**
 * POST /label/domestic
 * Generate a domestic address label PDF for a booked article.
 *
 * Body: Full label payload (see API spec section 1.5)
 *
 * Returns: PDF binary — client should handle as application/pdf
 */
router.post(
  "/domestic",
  asyncHandler(async (req, res) => {
    const pdfBuffer = await labelService.generateDomesticLabel(req.body);

    const barcode = req.body.barcode_no || req.body.barcodeNo || "label";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${barcode}.pdf"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(Buffer.from(pdfBuffer));
  })
);

module.exports = router;
