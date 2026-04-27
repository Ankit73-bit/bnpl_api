const labelService = require("../services/labelService");

/**
 * POST /label/domestic
 * Generate a domestic address label PDF.
 * Body: full label payload (see API spec §1.5)
 * Returns: PDF binary (application/pdf)
 */
async function generateDomestic(req, res) {
  const pdfBuffer = await labelService.generateDomesticLabel(req.body);

  const barcode = req.body.barcode_no || req.body.barcodeNo || "label";

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${barcode}.pdf"`);
  res.setHeader("Content-Length", pdfBuffer.length);
  res.send(Buffer.from(pdfBuffer));
}

module.exports = { generateDomestic };
