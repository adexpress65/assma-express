import * as functions from "firebase-functions/v2/https";
import fetch from "node-fetch";

export const aiSearch = functions.onRequest(async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "Missing query" });
      return;
    }

    const GEMINI_KEY = process.env.GEMINI_KEY; // 🔐 clé cachée
    const MODEL = "models/gemini-2.0-flash";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Tu es Askia, expert shopping A2Express.
Utilisateur cherche: "${query}"

Réponds JSON strict:
{
 "reply": "conseil court",
 "search": {
   "keywords": ["mot1","mot2"],
   "intent": "buy|compare|info"
 }
}`
                }
              ]
            }
          ]
        })
      }
    );

    const data: any = await response.json();

    let text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    // Extraction du JSON uniquement
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {
        reply: "Je vous montre les meilleurs résultats.",
        search: { keywords: [query], intent: "buy" }
      };
    }

    // Nettoyage final du reply
    if (parsed.reply) {
      const noisePhrases = [
        "here is the json requested",
        "here is the json",
        "requested json",
        "this is the json",
        "json format",
        "the following json",
        "voici l'analyse",
        "voici le json",
      ];
      noisePhrases.forEach((phrase) => {
        const regex = new RegExp(phrase, "gi");
        parsed.reply = parsed.reply.replace(regex, "");
      });
      parsed.reply = parsed.reply.trim();
    }

    res.json(parsed);
  } catch (error) {
    console.error("AI ERROR:", error);
    res.json({
      reply: "Recherche en cours...",
      search: { keywords: [req.body.query], intent: "buy" }
    });
  }
});
