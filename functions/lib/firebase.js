"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiSearch = void 0;
const functions = __importStar(require("firebase-functions/v2/https"));
const node_fetch_1 = __importDefault(require("node-fetch"));
exports.aiSearch = functions.onRequest(async (req, res) => {
    try {
        const { query } = req.body;
        if (!query || typeof query !== "string") {
            res.status(400).json({ error: "Missing query" });
            return;
        }
        const GEMINI_KEY = process.env.GEMINI_KEY;
        const MODEL = "models/gemini-2.0-flash";
        const response = await (0, node_fetch_1.default)(`https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent?key=${GEMINI_KEY}`, {
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
        });
        const data = await response.json();
        let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            text = jsonMatch[0];
        }
        let parsed;
        try {
            parsed = JSON.parse(text);
        }
        catch {
            parsed = {
                reply: "Je vous montre les meilleurs résultats.",
                search: { keywords: [query], intent: "buy" }
            };
        }
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
    }
    catch (error) {
        console.error("AI ERROR:", error);
        res.json({
            reply: "Recherche en cours...",
            search: { keywords: [req.body.query], intent: "buy" }
        });
    }
});
//# sourceMappingURL=firebase.js.map