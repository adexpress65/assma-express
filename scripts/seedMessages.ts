// scripts/seedMessages.ts
import { collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "../src/config/firebase";

const seedMessages = async () => {
  console.log("💬 Démarrage du seed des messages...");

  try {
    const convSnapshot = await getDocs(collection(db, "conversations"));
    if (convSnapshot.empty) {
      console.log("❌ Aucune conversation trouvée. Exécute d’abord seed:conversations !");
      return;
    }

    for (const conv of convSnapshot.docs) {
      const convId = conv.id;
      const convData = conv.data();

      // Vérifier s'il y a déjà des messages dans cette conversation
      const messagesRef = collection(db, `conversations/${convId}/messages`);
      const existing = await getDocs(messagesRef);

      if (!existing.empty) {
        console.log(`⏩ Conversation "${convData.title}" déjà peuplée (${existing.size} messages) — ignorée.`);
        continue;
      }

      // Sinon, on insère les messages
      let messages: any[] = [];

      switch (convData.type) {
        case "direct":
          messages = [
            { senderId: convData.participants[0], text: "Salut ! Comment vas-tu aujourd’hui ? 😊", createdAt: serverTimestamp() },
            { senderId: convData.participants[1], text: "Très bien et toi ? On se voit ce soir ? 🎉", createdAt: serverTimestamp() }
          ];
          break;
        case "group":
          messages = [
            { senderId: "user_tech1", text: "Quelqu’un a testé la nouvelle lib React Native ? 💡", createdAt: serverTimestamp() },
            { senderId: "user_tech3", text: "Oui, elle marche mieux que la précédente version 🚀", createdAt: serverTimestamp() }
          ];
          break;
        case "support":
          messages = [
            { senderId: "support_system", text: "Bonjour 👋, votre demande a été reçue.", createdAt: serverTimestamp() },
            { senderId: convData.participants[0], text: "Merci, le problème est résolu ✅", createdAt: serverTimestamp() }
          ];
          break;
        case "seller":
          messages = [
            { senderId: "seller_premium", text: "Une nouvelle promo vient de démarrer 🔥", createdAt: serverTimestamp() },
            { senderId: convData.participants[0], text: "Merci, je vais en profiter 😍", createdAt: serverTimestamp() }
          ];
          break;
        case "order":
          messages = [
            { senderId: "order_system", text: "Votre commande est en préparation 📦", createdAt: serverTimestamp() },
            { senderId: convData.participants[0], text: "Merci, j’attends la livraison 🚚", createdAt: serverTimestamp() }
          ];
          break;
        case "promo":
          messages = [
            { senderId: "promo_system", text: "🔥 Promo Flash : -50% cette semaine !", createdAt: serverTimestamp() },
            { senderId: convData.participants[0], text: "Génial 😄, je commande tout de suite !", createdAt: serverTimestamp() }
          ];
          break;
      }

      for (const msg of messages) {
        await addDoc(messagesRef, msg);
      }

      console.log(`✅ ${messages.length} messages ajoutés à "${convData.title}"`);
    }

    console.log("🎉 Tous les messages ont été insérés sans doublons !");
  } catch (error) {
    console.error("❌ Erreur lors du seed des messages:", error);
  }
};

seedMessages();
