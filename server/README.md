# India Post – Bulk Customer Integration (Node.js / Express)

A production-ready Express.js wrapper for the India Post Bulk Customer API.  
Covers authentication, tariff calculation, bulk booking, label generation, tracking, events, and webhook support.

---

## Project Structure

```
indiapost-integration/
├── src/
│   ├── app.js                  # Express app entry point
│   ├── config/
│   │   └── index.js            # Centralised config (reads from .env)
│   ├── middleware/
│   │   └── errorHandler.js     # Global error handler + asyncHandler wrapper
│   ├── routes/
│   │   ├── auth.js             # Login, refresh, token status
│   │   ├── tariff.js           # Speed Post & Business Parcel tariff
│   │   ├── pincode.js          # Pincode validation & post office search
│   │   ├── booking.js          # Bulk booking (JSON + file upload)
│   │   ├── label.js            # Domestic address label PDF generation
│   │   ├── tracking.js         # Bulk tracking + event download
│   │   └── webhook.js          # Real-time event receiver from India Post
│   ├── services/
│   │   ├── authService.js      # Token management with auto-refresh
│   │   ├── tariffService.js    # Speed Post & Business Parcel tariff calls
│   │   ├── pinCodeService.js   # Pincode lookup
│   │   ├── bookingService.js   # JSON + file + buffer booking
│   │   ├── labelService.js     # Label PDF generation
│   │   └── trackingService.js  # Tracking + event download
│   └── utils/
│       ├── apiClient.js        # Axios instance with retry logic
│       └── logger.js           # Winston logger
├── logs/                       # Auto-created log files
├── .env.example
├── package.json
└── README.md
```

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your India Post credentials

# 3. Start the server
npm start          # production
npm run dev        # development (with nodemon)
```

---

## Environment Variables

| Variable                  | Description                                      | Default                        |
|---------------------------|--------------------------------------------------|--------------------------------|
| `INDIAPOST_BASE_URL`       | Base URL for India Post API                      | `https://test.cept.gov.in`    |
| `INDIAPOST_USERNAME`       | Your registered username (phone/user ID)         | —                              |
| `INDIAPOST_PASSWORD`       | Your account password                            | —                              |
| `PORT`                     | Port to run the server on                        | `3000`                         |
| `NODE_ENV`                 | Environment (`development` / `production`)       | `development`                  |
| `TOKEN_REFRESH_BUFFER`     | Seconds before expiry to proactively refresh     | `300`                          |
| `WEBHOOK_SECRET`           | Optional secret for webhook verification         | —                              |

---

## API Reference

### Health Check
```
GET /health
```

---

### Auth

| Method | Endpoint         | Description                  |
|--------|------------------|------------------------------|
| POST   | /auth/login      | Force fresh login            |
| POST   | /auth/refresh    | Manually refresh token       |
| GET    | /auth/status     | View current token state     |

The auth service manages tokens **automatically** — all other endpoints call `getAccessToken()` internally, which proactively refreshes the token before it expires. You don't need to call `/auth/login` manually.

---

### Tariff

#### Speed Post
```
GET /tariff/speed-post?weight=250&sourcePincode=400001&destinationPincode=110001&length=30&width=21&height=5&ins=1000&pod=YES
```

#### Business Parcel
```
GET /tariff/business-parcel?weight=550&sourcePincode=141010&destinationPincode=110057&length=10&width=5&height=2&ins=1000
```

**Query Parameters:**

| Param                 | Required | Description                        |
|-----------------------|----------|------------------------------------|
| weight                | ✅       | Weight in grams                    |
| sourcePincode         | ✅       | 6-digit source pincode             |
| destinationPincode    | ✅       | 6-digit destination pincode        |
| length                | ✅       | Length in cm                       |
| width                 | ✅       | Width in cm                        |
| height                | ✅       | Height in cm                       |
| ins                   | ❌       | Insurance declared value           |
| pod                   | ❌       | Proof of Delivery: YES / NO        |

---

### Pincode Search
```
GET /pincode/search?pincode=400001&limit=10
```

---

### Booking

#### JSON Booking (up to 1,000 articles)
```
POST /booking/:customId
Content-Type: application/json

{
  "articles": [ { ...article object... }, ... ]
}
```

#### File Upload Booking (up to 5,000 articles)
```
POST /booking/:customId/upload
Content-Type: multipart/form-data

file: <articles.json>
```

**Article object mandatory fields:** `bulk_customer_id`, `contract_id`, `pickup_or_dropoff`, `article_type` (SP/BP), `physical_weight`, `shape_of_article`, `length`, `breadth_diameter`, `height`, `sender_name`, `sender_add_line_1`, `sender_city`, `sender_pincode`, `sender_mobile_no`, `receiver_name`, `receiver_add_line_1`, `receiver_city`, `receiver_pincode`, `receiver_mobile_no`, `alt_address_flag`, `pickup_address_flag`, `drop_off_pincode`, `codr_cod`, `value_for_codr_cod`, `bulk_reference`

---

### Label Generation
```
POST /label/domestic
Content-Type: application/json

{
  "identifier": "Domestic",
  "channel_type": "E",
  "user_type": "R",
  "barcode_no": "RK169063347IN",
  "service_type": "LETTER",
  "booking_type": "COM",
  "article_length": "18",
  "article_breadth": "15",
  "article_height": "3",
  "recipient_name": "John Doe",
  "recipient_addressl1": "123 Main Street",
  "recipient_addressl2": "Area Name",
  "recipient_addressl3": "",
  ...
}
```
Returns a **PDF file** (application/pdf) with the shipping label.

`channel_type` values: `I`, `E`, `K`, `M`  
`user_type` values: `G`, `D`, `A`, `T`

---

### Tracking

#### Bulk Track (up to 50 articles)
```
POST /tracking/bulk
Content-Type: application/json

{ "articles": ["EB126023474IN", "EB126023770IN"] }
```

#### Auto-batched Tracking (any number of articles)
```
POST /tracking/bulk-auto
Content-Type: application/json

{ "articles": ["BARCODE1", "BARCODE2", ..., "BARCODE200"] }
```
Automatically splits into batches of 50.

#### Download Events (XML)
```
POST /tracking/events
Content-Type: application/json

{
  "custId": "0000000000",
  "eventCode": "LE",
  "eventDate": "01052024"
}
```

| Event Code | Meaning        |
|------------|----------------|
| LE         | Last Event     |
| IB         | Item Booked    |
| ID         | Item Delivered |
| RT         | Returned       |

Returns XML response.

---

### Webhook

#### Endpoint
```
POST /webhook/events
```

#### Setup in India Post Portal
1. Go to **Self Service Portal** → **Settings** → **Master Configuration** → **Event Configuration**
2. Select **Webhook** as the Data Transfer Mode
3. Enter your public endpoint URL: `https://yourdomain.com/webhook/events`
4. Provide your **static IP** for whitelisting
5. Select the events you want to subscribe to (Item Booked, Delivered, Returned, etc.)

#### Sample Payload Received
```json
{
  "article_number": "AW784699994IN",
  "article_type": "SP_INLAND_PARCEL",
  "event_date": "2025-11-09",
  "event_time": "08:37:52",
  "event_code": "BAG_CLOSE",
  "event_description": "Bag Close",
  "event_office_name": "KADUGODI BNPL CENTRE",
  "booking_ref_id": 1026577399592963,
  "destination_city": "East Nimar",
  "destination_pincode": 450661,
  "receiver_name": "Nilesh",
  "tariff": 106.2,
  "weight_value": 740,
  "bulk_customer_id": 1000002954
}
```

#### Handled Event Codes
| Code               | Handler              |
|--------------------|----------------------|
| ITEM_BOOK          | `_onItemBooked()`    |
| BAG_CLOSE          | `_onItemInTransit()` |
| ITEM_DISPATCHED    | `_onItemInTransit()` |
| ITEM_BAGGED        | `_onItemInTransit()` |
| ITEM_DELIVERED     | `_onItemDelivered()` |
| ITEM_RETURNED / RTS | `_onItemReturned()` |
| ITEM_NOT_DELIVERED | `_onDeliveryFailed()`|

Extend the handler functions in `src/routes/webhook.js` with your own business logic (DB updates, push notifications, emails, COD remittance, etc.)

---

## Token Auto-Refresh Flow

```
Request comes in
       ↓
getAccessToken()
       ↓
Token exists AND not near expiry? → Use it directly
       ↓
Token near expiry (within 5 min)? → Refresh using refresh_token
       ↓
Refresh token expired / missing?  → Full re-login
       ↓
API call receives 401?            → Force re-login (via errorHandler)
```

---

## Error Handling

All routes use the `asyncHandler()` wrapper — no try/catch needed in route handlers. Errors flow automatically to the central `errorHandler` middleware which:

- Handles **401 from India Post** → triggers force re-login
- Handles **India Post API errors** → returns structured error with details
- Handles **validation errors** → 400 with descriptive message  
- Handles **network/retry failures** → after 3 retries with exponential backoff
- In **production**: hides stack traces from responses

---

## Production Checklist

- [ ] Change `INDIAPOST_BASE_URL` to the production URL (remove `/test.`)
- [ ] Use a persistent token store (Redis) instead of in-memory
- [ ] Expose `/webhook/events` via a public HTTPS URL
- [ ] Whitelist your static IP with India Post
- [ ] Set `NODE_ENV=production`
- [ ] Set up log rotation for `logs/` directory
- [ ] Add your DB logic to webhook handler functions
