import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../src/config/firebase";

const SUPPORT_INBOX_UID = "biU1QvlrGtZeqTLdbLONLGbyVQ92";

function assertMessagingSeedAllowed() {
  const onEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  const flagged = process.env.MESSAGING_SEED_OK === "1";
  if (!onEmulator || !flagged) {
    console.error(
      "Refus: seed messagerie autorisé seulement avec FIRESTORE_EMULATOR_HOST et MESSAGING_SEED_OK=1.",
    );
    process.exit(1);
  }
}

assertMessagingSeedAllowed();



/**
 * 🌱 Script de seed pour les conversations Firestore
 * Ce script crée des conversations de test entre utilisateurs existants.
 */

async function seedConversations(userId: string) {
  assertMessagingSeedAllowed();
  if (userId === SUPPORT_INBOX_UID) {
    throw new Error("Seed refusé: le super-admin ne peut pas être destinataire.");
  }
  console.log("🚀 Démarrage du seed des conversations...");

  const conversations = [
    // 🗣️ CONVERSATIONS SOCIALES (type: direct)
    {
      title: "Marie Dubois",
      type: "direct",
      participants: [userId, "user_marie"],
      participantNames: {
        [userId]: "Vous",
        user_marie: "Marie Dubois",
      },
      participantAvatars: {
        [userId]: "👤",
        user_marie: "👩",
      },
      lastMessage: "Salut ! Tu viens à la soirée ce soir ? 🎉",
      lastMessageTime: serverTimestamp(),
      unreadCount: {
        [userId]: 2,
        user_marie: 0,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },

    {
      title: "Groupe Tech",
      type: "group",
      participants: [userId, "user_tech1", "user_tech2", "user_tech3"],
      participantNames: {
        [userId]: "Vous",
        user_tech1: "Alice Dev",
        user_tech2: "Bob Code",
        user_tech3: "Charlie Tech",
      },
      participantAvatars: {
        [userId]: "👤",
        user_tech1: "💻",
        user_tech2: "📱",
        user_tech3: "🎮",
      },
      lastMessage: "Nouveau framework React annoncé ! 🚀",
      lastMessageTime: serverTimestamp(),
      unreadCount: {
        [userId]: 5,
        user_tech1: 0,
        user_tech2: 0,
        user_tech3: 0,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },

    // 💼 CONVERSATIONS BUSINESS (type: support)
    {
      title: "Support Technique",
      type: "support",
      participants: [userId, "support_system"],
      participantNames: {
        [userId]: "Vous",
        support_system: "Support Assma",
      },
      participantAvatars: {
        [userId]: "👤",
        support_system: "🛟",
      },
      lastMessage: "Votre problème a été résolu ? ✅",
      lastMessageTime: serverTimestamp(),
      unreadCount: {
        [userId]: 1,
        support_system: 0,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },

    {
      title: "Vendeur Premium",
      type: "seller",
      participants: [userId, "seller_premium"],
      participantNames: {
        [userId]: "Vous",
        seller_premium: "Boutique Elite",
      },
      participantAvatars: {
        [userId]: "👤",
        seller_premium: "⭐",
      },
      lastMessage: "Nouveaux produits disponibles ! 🛍️",
      lastMessageTime: serverTimestamp(),
      unreadCount: {
        [userId]: 0,
        seller_premium: 0,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },

    // 🛒 CONVERSATIONS SHOPPING (type: order)
    {
      title: "Commande #ASMA-78910",
      type: "order",
      participants: [userId, "order_system"],
      participantNames: {
        [userId]: "Vous",
        order_system: "Système Commandes",
      },
      participantAvatars: {
        [userId]: "👤",
        order_system: "📦",
      },
      lastMessage: "Votre colis est en livraison 🚚",
      lastMessageTime: serverTimestamp(),
      unreadCount: {
        [userId]: 3,
        order_system: 0,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },

    {
      title: "Promo Flash",
      type: "promo",
      participants: [userId, "promo_system"],
      participantNames: {
        [userId]: "Vous",
        promo_system: "Promotions",
      },
      participantAvatars: {
        [userId]: "👤",
        promo_system: "🔥",
      },
      lastMessage: "Nouvelle promotion -50% cette semaine ! 💰",
      lastMessageTime: serverTimestamp(),
      unreadCount: {
        [userId]: 0,
        promo_system: 0,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  ];

  try {
    for (const conversation of conversations) {
      const participants = Array.isArray(conversation.participants)
        ? conversation.participants
        : [];
      if (participants.includes(SUPPORT_INBOX_UID)) {
        throw new Error("Seed refusé: le super-admin ne peut pas être destinataire.");
      }
      const docRef = await addDoc(collection(db, "conversations"), conversation);
      console.log(`✅ Conversation créée : ${conversation.title} (ID: ${docRef.id})`);
    }

    console.log("🎉 Toutes les conversations de test ont été créées avec succès !");
  } catch (error) {
    console.error("❌ Erreur lors du seed des conversations :", error);
  }
}

// 🧩 Exécution du script
(async () => {
  const testUserId = "user_admin"; // 🧠 Remplace par un ID utilisateur Firestore réel si besoin
  await seedConversations(testUserId);
})();
