# India Post – Bulk Customer Integration (Node.js / Express)

A production-ready Express.js wrapper for the India Post Bulk Customer API.  
Covers authentication, tariff calculation, bulk booking, label generation, tracking, events, and webhook support.

---

## Project Structure

```
server/
├── app.js                        # Express bootstrap & route mounting
├── config/
│   ├── index.js                  # Centralised config (reads from .env)
│   └── database.js               # MongoDB connection management
├── controllers/                  # ← HTTP layer: parse req → call service → send res
│   ├── index.js                  # Barrel export
│   ├── authController.js
│   ├── bookingController.js
│   ├── labelController.js
│   ├── pinCodeController.js
│   ├── tariffController.js
│   ├── trackingController.js
│   └── webhookController.js
├── middleware/
│   ├── errorHandler.js           # Global error handler + asyncHandler wrapper
│   └── validate.js               # Reusable req.body / req.query validators
├── models/                       # Mongoose schemas
│   ├── index.js
│   ├── ArticleStatus.js
│   ├── Booking.js
│   ├── TariffLog.js
│   ├── Token.js
│   └── TrackingEvent.js
├── routes/                       # ← Thin: only import controller + wire up paths
│   ├── auth.js
│   ├── booking.js
│   ├── label.js
│   ├── pincode.js
│   ├── tariff.js
│   ├── tracking.js
│   └── webhook.js
├── services/                     # ← Business logic: call India Post API + DB
│   ├── authService.js
│   ├── bookingService.js
│   ├── labelService.js
│   ├── pinCodeService.js
│   ├── tariffService.js
│   ├── trackingService.js
│   └── webhookService.js         # Event processing & business-logic handlers
└── utils/
    ├── apiClient.js              # Axios instance with retry + logging
    └── logger.js                 # Winston logger
```

### Layer responsibilities

| Layer | Responsibility |
|---|---|
| **routes/** | Wire HTTP method + path to a controller function |
| **controllers/** | Parse `req`, validate HTTP-level inputs, call service, send `res` |
| **services/** | All business logic — India Post API calls, DB reads/writes |
| **models/** | Mongoose schemas and instance methods |
| **middleware/** | Cross-cutting: error handling, request validation helpers |
| **utils/** | Pure helpers — Axios client, Winston logger |

---

## Setup

```bash
# 1. Install dependencies
cd server
npm install

# 2. Configure environment
cp .env.example .env
# Fill in your India Post credentials and MongoDB URI

# 3. Start the server
npm start          # production
npm run dev        # development (nodemon)
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `INDIAPOST_BASE_URL` | India Post API base URL | `https://test.cept.gov.in` |
| `INDIAPOST_USERNAME` | Registered phone / user ID | — |
| `INDIAPOST_PASSWORD` | Account password | — |
| `MONGODB_URI` | MongoDB Atlas connection string | — |
| `PORT` | HTTP port | `3000` |
| `NODE_ENV` | `development` or `production` | `development` |
| `TOKEN_REFRESH_BUFFER` | Seconds before expiry to proactively refresh | `300` |
| `WEBHOOK_SECRET` | Optional secret for webhook verification | — |

---

## API Reference

### Health Check
```
GET /health
```

---

### Auth

| Method | Path | Description |
|---|---|---|
| POST | /auth/login | Force fresh login |
| POST | /auth/refresh | Manually refresh token |
| GET | /auth/status | View current token state |

**You only need to call `/auth/login` once.** After that, `getAccessToken()` in `authService` handles proactive refresh automatically.

---

### Tariff

```
GET /tariff/speed-post?weight=250&sourcePincode=400001&destinationPincode=110001&length=30&width=21&height=5&ins=1000&pod=YES
GET /tariff/business-parcel?weight=550&sourcePincode=141010&destinationPincode=110057&length=10&width=5&height=2&ins=1000
```

| Param | Required | Description |
|---|---|---|
| weight | ✅ | Weight in grams |
| sourcePincode | ✅ | 6-digit source pincode |
| destinationPincode | ✅ | 6-digit destination pincode |
| length / width / height | ✅ | Dimensions in cm |
| ins | ❌ | Declared insurance value |
| pod | ❌ | Proof of Delivery: YES / NO (Speed Post only) |

---

### Pincode Search
```
GET /pincode/search?pincode=400001&limit=10
```

---

### Booking

```
POST /booking/:customId
Content-Type: application/json
{ "articles": [ { ...article object... } ] }
```

```
POST /booking/:customId/upload
Content-Type: multipart/form-data
file: articles.json   (up to 5,000 articles)
```

---

### Label Generation
```
POST /label/domestic
Content-Type: application/json
{ "channel_type": "E", "user_type": "R", "barcode_no": "RK169063347IN", ... }
```
Returns a **PDF** (application/pdf) with the shipping label.

---

### Tracking

```
POST /tracking/bulk          { "articles": ["EB126023474IN", "EB126023770IN"] }
POST /tracking/bulk-auto     { "articles": [ ...up to any number... ] }
POST /tracking/events        { "custId": "0000000000", "eventCode": "LE", "eventDate": "01052024" }
```

`eventCode` values: `LE` (Last Event) · `IB` (Item Booked) · `ID` (Item Delivered) · `RT` (Returned)

---

### Webhook

```
POST /webhook/events    ← India Post pushes events here
GET  /webhook/events    ← Reachability check
```

**Setup in India Post Portal:**
Self Service Portal → Settings → Master Configuration → Event Configuration → Webhook

Enter your public HTTPS URL and static IP for whitelisting.

**Adding business logic to webhook events:**  
Edit `services/webhookService.js` — the handlers `_onItemBooked`, `_onItemInTransit`, `_onItemDelivered`, `_onItemReturned`, `_onDeliveryFailed` have TODO comments for your integrations.

---

## Token Auto-Refresh Flow

```
Request arrives
     ↓
getAccessToken()
     ↓
In-memory cache valid?     → use it (fastest path)
     ↓
DB token valid?            → warm cache, use it
     ↓
Token expiring soon?       → refresh with refresh_token
     ↓
Refresh token expired?     → full re-login
     ↓
API returns 401?           → errorHandler forces re-login
```

---

## Error Handling

All routes use `asyncHandler()` — no try/catch needed in controllers.  
Errors flow to the central `errorHandler` in `middleware/errorHandler.js`:

- **401 from India Post** → triggers force re-login
- **India Post API errors** → 502 with structured `details`
- **Validation errors** → 400 with descriptive message
- **Network errors** → retried 3× with exponential backoff before failing
- **Production** → stack traces are hidden from responses

---

## Production Checklist

- [ ] Switch `INDIAPOST_BASE_URL` to the production URL (remove `test.`)
- [ ] Set `NODE_ENV=production`
- [ ] Expose `/webhook/events` via a public HTTPS URL
- [ ] Whitelist your static IP with India Post
- [ ] Set up log rotation for the `logs/` directory
- [ ] Add your business logic to `services/webhookService.js` handlers
