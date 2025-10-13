# 🧩 ACES & Shopify Integration API

This project is a **Node.js + Express + MongoDB + Shopify API integration** designed to:
- Parse and store ACES/PIES product data in MongoDB  
- Filter and query products via REST endpoints  
- Synchronize MongoDB-stored products to Shopify  
- Manage (delete/reset) Shopify store data programmatically  

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-------------|
| **Runtime** | Node.js (v18+) |
| **Framework** | Express.js |
| **Database** | MongoDB (Mongoose ODM) |
| **External API** | Shopify Admin REST API (2024-07) |
| **HTTP Client** | Axios |
| **Environment Config** | dotenv |
| **Utility** | Nodemon (for development) |

---

## 🗂️ Project Structure

```
src/
│
├── config/
│   └── db.js                 # MongoDB connection setup
│
├── models/
│   └── Product.js            # Mongoose schema for ACES/PIES product data
│
├── routes/
│   ├── searchAce.js          # Search/filter API for products
│   ├── syncShopify.js        # Sync MongoDB products with Shopify
│   └── deleteAllProducts.js  # Bulk delete products from Shopify
│
└── server.js                 # Main Express entrypoint
```

---

## ⚙️ Environment Setup

Create a `.env` file in your project root with the following variables:

```env
PORT=3000
MONGO_URI=mongodb+srv://dummyUser:dummyUser@cluster0.6z504f9.mongodb.net/?retryWrites=true&w=majority
SHOPIFY_STORE_DOMAIN=yourstore.myshopify.com
SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 🔧 Installation & Run

```bash
# 1. Install dependencies
npm install

# 2. Start server in development mode
npx nodemon src/server.js

# 3. Server will run at:
http://localhost:3000
```

---

## 🧱 MongoDB Product Model

Each product in MongoDB follows this schema:

```json
{
  "sku": "C47-0324",
  "title": "SP Performance Cross Drilled Performance Rotor Set, Grey Zinc Coated",
  "shortDesc": "Brake Rotor Set",
  "longDesc": "<p>SP Performance Cross-Drilled Rotors...</p>",
  "vendor": "SP Performance",
  "attributes": "Color: Grey, Surface Type: Cross Drilled",
  "images": [
    "Rotor-Drilled-Hole-Chamfer-2080x2080.png",
    "SP-Performance-Rotor-Cross-Drilled-Grey-2080x2080.png"
  ],
  "dimensions": "7.0000x14.0000x14.0000",
  "weight": "10.0000",
  "createdAt": "2025-10-12T00:00:00.000Z"
}
```

---

## 🔍 Product Search Endpoint

**Route:** `GET /search-ace?brand=SP%20Performance`

Search products by brand, make, or attributes.

**Example:**
```
GET http://localhost:3000/search-ace?brand=SP%20Performance
```

**Response:**
```json
[
  {
    "sku": "C47-0324",
    "title": "SP Performance Cross Drilled Performance Rotor Set, Grey Zinc Coated",
    "vendor": "SP Performance",
    "shortDesc": "Brake Rotor Set"
  }
]
```

---

## 🔄 Shopify Synchronization Endpoint

**Route:** `POST /sync-shopify`

Uploads unsynced MongoDB products to Shopify, creates product listings, and marks them as synced.

**Response Example:**
```json
{
  "success": true,
  "syncedCount": 1,
  "failedCount": 0,
  "results": [
    {
      "title": "SP Performance Cross Drilled Performance Rotor Set, Grey Zinc Coated",
      "sku": "C47-0324",
      "shopifyId": 14762082992493
    }
  ]
}
```

---

## 🧹 Delete All Products from Shopify

**Route:** `DELETE /delete-all-products`

Deletes all products from your Shopify store.

**Response Example:**
```json
{
  "success": true,
  "message": "Deleted 87 products successfully."
}
```

---

## 🧠 Best Practices

- Respect Shopify API rate limits (≥500ms delay between requests)
- Tag synced items (e.g., “PIES”) for easy tracking
- Log all API responses for debugging
- Only run delete-all-products on test/staging stores
- Automate sync with CRON or background jobs

---

## 🧾 Workflow Summary

1. Parse ACES/PIES XML → Store products in MongoDB  
2. Verify via `/search-ace`  
3. Sync to Shopify using `/sync-shopify`  
4. Wipe products with `/delete-all-products` if needed

---

## 🧩 Future Improvements

- Add product price mapping from PIES data  
- Implement SKU-based update logic  
- Add `/sync-single/:sku` endpoint  
- Support inventory and product variants  

---

## 👨‍💻 Maintainer

**Project Owner:** You  
**Role:** ACES & Shopify Integration Developer  
**Tech Stack:** Node.js, Express, MongoDB, Shopify Admin API  
**Version:** 1.0.0  
**Status:** Stable Development Build  
