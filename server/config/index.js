require("dotenv").config();

const config = {
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || "development",
  },

  indiaPost: {
    baseUrl: process.env.INDIAPOST_BASE_URL || "https://test.cept.gov.in",
    username: process.env.INDIAPOST_USERNAME,
    password: process.env.INDIAPOST_PASSWORD,

    endpoints: {
      login:                "/beextcustomer/v1/access/login",
      tokenRefresh:         "/beextcustomer/v1/access/TokenWithRtoken",
      speedPostTariff:      "/beextcustomer/v1/speedpost/tariffs",
      businessParcelTariff: "/beextcustomer/v1/business-parcel-tariff/calculate",
      pinCodeSearch:        "/bemasterdata/v1/offices/limiteddetails",
      bulkBookingJson:      "/beextcustomer/process-articles",
      bulkBookingFile:      "/beextcustomer/process-articles-file",
      addressLabel:         "/beextcustomer/v1/label/create/domestic",
      eventDownload:        "/beextcustomer/v1/event/download",
      bulkTracking:         "/beextcustomer/v1/tracking/bulk",
    },
  },

  token: {
    refreshBuffer: parseInt(process.env.TOKEN_REFRESH_BUFFER || "300", 10),
  },

  webhook: {
    secret: process.env.WEBHOOK_SECRET || "",
  },

  db: {
    uri: process.env.MONGODB_URI || "",
  },
};

module.exports = config;
