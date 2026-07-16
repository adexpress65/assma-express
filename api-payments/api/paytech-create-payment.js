import axios from "axios";

export default async function handler(req, res) {
  try {
    const { amount, currency, reference } = req.body;

    const payload = {
      item_name: "Paiement ASSMA",
      item_price: amount,
      currency: currency || "XOF",
      ref_command: reference,
      command_name: "ASSMA Paiement",
      env: "test", // VRAI MODE PRO: "prod"
    };

    const response = await axios.post(
      `${process.env.PAYTECH_BASE_URL}/payment/request-payment`,
      payload,
      {
        headers: {
          "API_KEY": process.env.PAYTECH_API_KEY,
          "API_SECRET": process.env.PAYTECH_SECRET_KEY,
          "Content-Type": "application/json",
        }
      }
    );

    res.status(200).json(response.data);

  } catch (error) {
    console.error("PAYTECH ERROR:", error.response?.data || error);
    res.status(500).json({
      error: "PayTech creation failed",
      details: error.response?.data || error.message
    });
  }
}
