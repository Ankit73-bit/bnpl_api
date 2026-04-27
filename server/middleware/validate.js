/**
 * Request validation middleware helpers.
 *
 * Each function returns an Express middleware that validates specific parts
 * of the request and calls next() or responds 400.
 *
 * Usage in routes (or controllers):
 *   router.post("/path", validate.body(["field1", "field2"]), asyncHandler(myCtrl));
 */

/**
 * Ensure the listed fields exist and are non-empty strings/numbers in req.body.
 *
 * @param {string[]} fields - Field names that must be present
 */
function body(fields) {
  return (req, res, next) => {
    const missing = fields.filter(
      (f) => req.body[f] === undefined || req.body[f] === null || req.body[f] === ""
    );
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required body field(s): ${missing.join(", ")}`,
      });
    }
    next();
  };
}

/**
 * Ensure the listed fields exist and are non-empty in req.query.
 *
 * @param {string[]} fields - Query-param names that must be present
 */
function query(fields) {
  return (req, res, next) => {
    const missing = fields.filter(
      (f) => req.query[f] === undefined || req.query[f] === ""
    );
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required query param(s): ${missing.join(", ")}`,
      });
    }
    next();
  };
}

module.exports = { body, query };
