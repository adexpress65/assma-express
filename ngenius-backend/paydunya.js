import express from "express";
import admin from "firebase-admin";
import axios from "axios";

const router = express.Router();

/* ============================
    CONFIG PAYDUNYA API
============================ */

// Correction : Utilisation des URLs officielles recommandées
const getPaydunyaConfig = () => ({
  baseUrl: process.env.PAYDUNYA_MODE === "live" 
    ? "https://app.paydunya.com/api/v1" 
    : "https://app.paydunya.com/sandbox-api/v1",
  headers: {
    "Content-Type": "application/json",
    "PAYDUNYA-MASTER-KEY": process.env.PAYDUNYA_MASTER_KEY,
    "PAYDUNYA-PRIVATE-KEY": process.env.PAYDUNYA_PRIVATE_KEY,
    "PAYDUNYA-TOKEN": process.env.PAYDUNYA_TOKEN,
    "PAYDUNYA-MODE": process.env.PAYDUNYA_MODE || "test",
  }
});

/* ============================
    CREATE PAYMENT
============================ */

router.post("/create-paydunya-payment", async (req, res) => {
  try {
    const { orderId, amount, itemsCount, userId } = req.body;
    const config = getPaydunyaConfig();

    if (!orderId || !amount) {
      return res.status(400).json({ error: "Données manquantes (orderId ou amount)" });
    }

    const payload = {
      invoice: {
        items: [
          {
            name: `Commande #${orderId}`,
            quantity: parseInt(itemsCount) || 1,
            unit_price: parseFloat(amount),
            total_price: parseFloat(amount),
            description: "Paiement sécurisé A2 Express",
          },
        ],
        total_amount: parseFloat(amount),
        description: "Paiement A2 Express",
      },
      store: {
        name: "A2Express", // Plus court pour l'affichage mobile
        tagline: "Votre partenaire B2B au Mali",
        phone: "+22375292946",
        postal_address: "Bamako, Mali",
      },
      custom_data: {
        order_id: orderId,
        user_id: userId,
      },
      actions: {
        cancel_url: "https://a2-expres.com/payment/cancel.html",
        return_url: "https://a2-expres.com/payment/success.html",
        // Optionnel : ajouter le callback_url ici si tu veux que PayDunya appelle ton webhook
        callback_url: "https://ngenius-backend.onrender.com/webhook/paydunya",
      },
    };

    console.log("📡 Envoi à PayDunya:", config.baseUrl);

    const response = await axios.post(
      `${config.baseUrl}/checkout-invoice/create`,
      payload,
      { headers: config.headers }
    );

    // PayDunya renvoie le lien dans response_text si c'est réussi (code 00)
    if (response.data.response_code === "00") {
      return res.json({
        url: response.data.response_text,
        token: response.data.token,
      });
    } else {
      console.error("❌ PayDunya Refus:", response.data.response_text);
      return res.status(400).json({ error: response.data.response_text });
    }

  } catch (error) {
    console.error("🔥 PayDunya API error:", error.response?.data || error.message);
    return res.status(500).json({ 
      error: "Erreur lors de la création du paiement",
      details: error.response?.data?.response_text || error.message 
    });
  }
});

/* ============================
    WEBHOOK CONFIRMATION
============================ */
// ... (ton webhook est correct, assure-toi juste d'utiliser config.headers aussi)

export default router;