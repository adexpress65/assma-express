const fetch = require("node-fetch");

const BASE_URL = process.env.PAYTECH_BASE_URL;
const API_KEY = process.env.PAYTECH_API_KEY;
const SECRET_KEY = process.env.PAYTECH_SECRET_KEY;

/**
 * Create PayTech Payment
 */
async function createPaytechPayment({ amount, description }) {
  const payload = {
    item_name: description || "Paiement ASSMA",
    item_price: amount,
    currency: "XOF",
    ref_command: "CMD-" + Date.now()
  };

  const headers = {
    "Content-Type": "application/json",
    "API_KEY": API_KEY,
    "API_SECRET": SECRET_KEY
  };

  const res = await fetch(`${BASE_URL}/payment`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`PAYTECH ERROR ${res.status}: ${text}`);
  }

  return JSON.parse(text);
}

module.exports = { createPaytechPayment };
