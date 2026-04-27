const express = require("express");
const multer = require("multer");
const router = express.Router();
const { asyncHandler } = require("../middleware/errorHandler");
const { bookJson, bookFile } = require("../controllers/bookingController");

// Memory storage — no temp files written to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/json" || file.originalname.endsWith(".json")) {
      cb(null, true);
    } else {
      cb(new Error("Only JSON files are accepted for bulk booking"));
    }
  },
});

// POST /booking/:customId          — JSON body, up to 1,000 articles
router.post("/:customId",          asyncHandler(bookJson));

// POST /booking/:customId/upload   — JSON file upload, up to 5,000 articles
router.post("/:customId/upload", upload.single("file"), asyncHandler(bookFile));

module.exports = router;
