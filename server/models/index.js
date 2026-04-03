const mongoose = require("mongoose");

/**
 * Models index
 * Single import point for all Mongoose models.
 *
 * Usage:
 *   const { Booking, TrackingEvent, ArticleStatus, Token, TariffLog } = require("../models");
 */
const Token         = require("./Token");
const Booking       = require("./Booking");
const TrackingEvent = require("./TrackingEvent");
const ArticleStatus = require("./ArticleStatus");
const TariffLog     = require("./TariffLog");

module.exports = {
  Token,
  Booking,
  TrackingEvent,
  ArticleStatus,
  TariffLog,
};
