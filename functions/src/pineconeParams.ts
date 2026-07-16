import { defineSecret } from "firebase-functions/params";

/** Secret Google Cloud / Firebase — définir avec : firebase functions:secrets:set PINECONE_API_KEY */
export const pineconeApiKey = defineSecret("PINECONE_API_KEY");
