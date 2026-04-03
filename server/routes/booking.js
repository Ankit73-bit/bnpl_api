const express = require("express");
const multer = require("multer");
const router = express.Router();
const bookingService = require("../services/bookingService");
const { asyncHandler } = require("../middleware/errorHandler");

// Use memory storage so we don't write temp files to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/json" || file.originalname.endsWith(".json")) {
      cb(null, true);
    } else {
      cb(new Error("Only JSON files are accepted for bulk booking"));
    }
  },
});

/**
 * POST /booking/:customId
 * Book articles via JSON body (up to 1,000 articles).
 *
 * Body: { "articles": [ ...article objects... ] }
 */
router.post(
  "/:customId",
  asyncHandler(async (req, res) => {
    const { customId } = req.params;
    const { articles } = req.body;

    if (!articles || !Array.isArray(articles)) {
      return res.status(400).json({
        success: false,
        error: 'Request body must contain an "articles" array',
      });
    }

    const result = await bookingService.bookArticlesJson(customId, articles);
    res.json(result);
  })
);

/**
 * POST /booking/:customId/upload
 * Book articles via JSON file upload (up to 5,000 articles).
 *
 * Form-data key: file (JSON file)
 */
router.post(
  "/:customId/upload",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const { customId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Send a JSON file with form-data key "file".',
      });
    }

    const result = await bookingService.bookArticlesBuffer(
      customId,
      req.file.buffer,
      req.file.originalname
    );

    res.json(result);
  })
);

module.exports = router;
