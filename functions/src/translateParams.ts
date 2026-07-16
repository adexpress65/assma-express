import { defineSecret } from "firebase-functions/params";

/** Définir avec : firebase functions:secrets:set GOOGLE_TRANSLATE_API_KEY */
export const googleTranslateApiKey = defineSecret("GOOGLE_TRANSLATE_API_KEY");
