/**
 * lib/ngenius.js
 * FINAL VERSION — ORABANK MALI / N-GENIUS (Sandbox)
 */

const fetch = require("node-fetch");

const BASE = process.env.NGENIUS_SANDBOX_BASE;
const IDENTITY_URL = process.env.NGENIUS_IDENTITY_URL;
const MERCHANT_API_KEY = process.env.NGENIUS_MERCHANT_API_KEY;
const REALM_NAME = process.env.NGENIUS_REALM_NAME;
const OUTLET = process.env.NGENIUS_OUTLET_REF;

/**
 * STEP 1 — Get access_token
 * Authorization: Basic <merchant_api_key>
 * Body: grant_type=client_credentials&scope=payments&realmName=OBMaliSandbox
 */
async function getAccessToken() {
  const body = new URLSearchParams();
  body.append("grant_type", "client_credentials");
  body.append("scope", "payments");
  body.append("realmName", REALM_NAME);

  const headers = {
    "Authorization": `Basic ${MERCHANT_API_KEY}`,
    "Content-Type": "application/x-www-form-urlencoded"
  };

  const res = await fetch(IDENTITY_URL, {
    method: "POST",
    headers,
    body: body.toString()
  });

  const text = await res.text();

  if (!res.ok) {
    console.error("❌ TOKEN ERROR:", text);
    throw new Error(`TOKEN ERROR ${res.status}: ${text}`);
  }

  const json = JSON.parse(text);
  return json.access_token;
}

/**
 * STEP 2 — Create Order
 */
async function createOrder(orderPayload, accessToken) {
  const url = `${BASE}/transactions/outlets/${OUTLET}/orders`;

  const headers = {
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "application/vnd.ni-payment.v2+json",
    "Accept": "application/vnd.ni-payment.v2+json"
  };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(orderPayload)
  });

  const text = await res.text();

  if (!res.ok) {
    console.error("❌ ORDER ERROR:", text);
    throw new Error(`ORDER ERROR ${res.status}: ${text}`);
  }

  const json = JSON.parse(text);
  return json;
}

module.exports = {
  getAccessToken,
  createOrder
};
