const crypto = require("crypto");
const fetch = require("node-fetch");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Méthode non autorisée" });
    }

    const { amount, currency, phone } = req.body;

    if (!amount || !currency || !phone) {
      return res.status(400).json({ error: "amount, currency, phone requis" });
    }

    const apiKey = process.env.PAYTECH_API_KEY;
    const secretKey = process.env.PAYTECH_SECRET_KEY;
    const baseUrl = process.env.PAYTECH_BASE_URL;
    const successUrl = process.env.PAYTECH_SUCCESS_URL;
    const ipnUrl = process.env.PAYTECH_IPN_URL;

    const fullUrl = `${baseUrl}/payment_request`;

    const payload = {
      item_name: "Paiement ASSMA",
      item_price: amount,
      currency: currency,
      customer_phone: phone,
      ref_command: crypto.randomUUID(),
      ipn_url: ipnUrl,
      success_url: successUrl,
    };

    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
        "Api-Secret": secretKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    return res.status(200).json({ ok: true, data });

  } catch (err) {
    console.error("PayTech ERROR:", err);
    return res.status(500).json({ error: "Erreur interne", details: err.message });
  }
};
