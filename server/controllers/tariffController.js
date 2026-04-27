const tariffService = require("../services/tariffService");

// ─── Shared query-param parser ────────────────────────────────────────────────

/**
 * Parse and validate the common dimensional + pincode query params shared
 * by both tariff endpoints.
 * Returns { params, error } — if error is set, send a 400 and return early.
 */
function _parseDimensionParams(query) {
  const { weight, sourcePincode, destinationPincode, length, width, height } = query;

  if (!weight || !sourcePincode || !destinationPincode || !length || !width || !height) {
    return {
      params: null,
      error: "Required query params: weight, sourcePincode, destinationPincode, length, width, height",
    };
  }

  return {
    error: null,
    params: {
      weight:             Number(weight),
      sourcePincode,
      destinationPincode,
      length:             Number(length),
      width:              Number(width),
      height:             Number(height),
    },
  };
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /tariff/speed-post
 * Query params: weight, sourcePincode, destinationPincode, length, width, height, ins, pod
 */
async function getSpeedPostTariff(req, res) {
  const { params, error } = _parseDimensionParams(req.query);
  if (error) return res.status(400).json({ success: false, error });

  const { ins, pod } = req.query;
  if (ins !== undefined) params.ins = Number(ins);
  if (pod !== undefined) params.pod = pod;

  const data = await tariffService.getSpeedPostTariff(params);
  res.json({ success: true, data });
}

/**
 * GET /tariff/business-parcel
 * Query params: weight, sourcePincode, destinationPincode, length, width, height, ins
 */
async function getBusinessParcelTariff(req, res) {
  const { params, error } = _parseDimensionParams(req.query);
  if (error) return res.status(400).json({ success: false, error });

  const { ins } = req.query;
  if (ins !== undefined) params.ins = Number(ins);

  const data = await tariffService.getBusinessParcelTariff(params);
  res.json({ success: true, data });
}

module.exports = { getSpeedPostTariff, getBusinessParcelTariff };
