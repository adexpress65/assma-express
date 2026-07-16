import { onRequest } from "firebase-functions/v2/https";

/**
 * Clé Gemini : définir GEMINI_KEY (ou GOOGLE_API_KEY) dans les variables d’environnement
 * de la fonction sur Google Cloud Console — évite d’exiger un secret Firebase inexistant au déploiement.
 */
function geminiApiKey(): string | undefined {
  const k = process.env.GEMINI_KEY || process.env.GOOGLE_API_KEY;
  return k && String(k).trim().length > 0 ? String(k).trim() : undefined;
}

export const aiSearch = onRequest(
  { region: "europe-west1" },
  async (req, res) => {
    try {
      const query = req.body?.query || "";

      if (!query) {
        res.status(400).json({ error: "Missing query" });
        return;
      }

      const apiKey = geminiApiKey();
      if (!apiKey) {
        res.status(503).json({ error: "GEMINI_KEY non configurée sur la fonction" });
        return;
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Tu es Askia, expert e-commerce A2Express.
Analyse la recherche suivante: "${query}"
Réponds court et donne mots-clés produits.`,
                  },
                ],
              },
            ],
          }),
        },
      );

      const data: any = await response.json();

      let reply =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Analyse en cours...";

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
        reply = reply.replace(regex, "");
      });

      reply = reply.replace(/[:{}"]/g, "").trim();

      res.json({
        reply,
        search: {
          keywords: query.split(" "),
          intent: "search",
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "AI failed" });
    }
  },
);
