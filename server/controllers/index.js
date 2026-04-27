/**
 * Controllers barrel
 * Single import point for all controller modules.
 *
 * Usage:
 *   const { authController, bookingController } = require("../controllers");
 */
module.exports = {
  authController:     require("./authController"),
  tariffController:   require("./tariffController"),
  pinCodeController:  require("./pinCodeController"),
  bookingController:  require("./bookingController"),
  labelController:    require("./labelController"),
  trackingController: require("./trackingController"),
  webhookController:  require("./webhookController"),
};
