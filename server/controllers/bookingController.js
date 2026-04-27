const bookingService = require("../services/bookingService");

/**
 * POST /booking/:customId
 * Book articles via JSON body (up to 1,000 articles).
 * Body: { "articles": [ ...article objects... ] }
 */
async function bookJson(req, res) {
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
}

/**
 * POST /booking/:customId/upload
 * Book articles via JSON file upload (up to 5,000 articles).
 * Form-data key: file (JSON file)
 */
async function bookFile(req, res) {
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
}

module.exports = { bookJson, bookFile };
