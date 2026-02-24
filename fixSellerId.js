console.log("SCRIPT ADMIN LANCE");

import admin from "firebase-admin";
import fs from "fs";

// Charger clé admin
const serviceAccount = JSON.parse(
  fs.readFileSync("./serviceAccount.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function fixSellerId() {
  try {
    console.log("Connexion Firebase ADMIN...");

    const snapshot = await db.collection("products").get();

    console.log("Produits trouvés:", snapshot.size);

    if (snapshot.empty) {
      console.log("Aucun produit -> rien à corriger");
      return;
    }

    let corrected = 0;
    let skipped = 0;
    let errors = 0;

    for (const productDoc of snapshot.docs) {
      const data = productDoc.data();

      if (!data.sellerId || data.sellerId === "") {

        if (!data.companyId) {
          console.log("❌ Pas de companyId -> ignoré:", productDoc.id);
          errors++;
          continue;
        }

        console.log("✔ Correction produit:", productDoc.id);

        await db.collection("products").doc(productDoc.id).update({
          sellerId: data.companyId
        });

        corrected++;
      } else {
        skipped++;
      }
    }

    console.log("------ RESULTAT ------");
    console.log("Corrigés :", corrected);
    console.log("Ignorés  :", skipped);
    console.log("Erreurs  :", errors);
    console.log("TOTAL    :", snapshot.size);

  } catch (err) {
    console.error("ERREUR:", err);
  }
}

fixSellerId()
  .then(() => {
    console.log("SCRIPT TERMINE");
    process.exit(0);
  })
  .catch((err) => {
    console.error("ECHEC:", err);
    process.exit(1);
  });
