import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";

export default function ProductPromoPushScreen() {
  const router = useRouter();
  const { userRole } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [productId, setProductId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sending, setSending] = useState(false);

  if (userRole !== "super-admin") {
    return (
      <SafeAreaView style={styles.safe}>
        <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#333" />
          <Text style={styles.backText}>Retour</Text>
        </TouchableOpacity>
        <Text style={styles.denied}>Accès réservé aux super-administrateurs.</Text>
      </SafeAreaView>
    );
  }

  const onSend = async () => {
    const t = title.trim();
    const b = body.trim();
    const pid = productId.trim();
    if (!t || !b || !pid) {
      Alert.alert("Champs requis", "Renseignez au minimum le titre, le texte et l’ID produit.");
      return;
    }

    setSending(true);
    try {
      const fn = httpsCallable(functions, "sendProductPromoBroadcast");
      const res = await fn({
        title: t,
        body: b,
        productId: pid,
        imageUrl: imageUrl.trim() || undefined,
      });
      const data = res.data as { ok?: boolean; sent?: number; message?: string };
      if (data?.ok && typeof data.sent === "number") {
        Alert.alert(
          "Envoi lancé",
          `Notifications mises en file pour environ ${data.sent} appareil(s) avec token valide.`,
        );
      } else {
        Alert.alert(
          "Attention",
          data?.message || "Aucun envoi (aucun token valide ou erreur serveur).",
        );
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message?: string }).message)
          : "Erreur inconnue";
      Alert.alert("Erreur", msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#333" />
          <Text style={styles.backText}>Retour</Text>
        </TouchableOpacity>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.h1}>Push promo produit</Text>
          <Text style={styles.sub}>
            Style marketplace : notification système avec image (si URL HTTPS) et ouverture
            de la fiche produit au toucher. Réservé au super-admin ; déployez la Cloud Function
            `sendProductPromoBroadcast` sur Firebase.
          </Text>

          <Text style={styles.label}>Titre (accroche)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex. Flash −30 % sur les casques"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          <Text style={styles.label}>Texte</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Courte description du produit ou de l’offre"
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={240}
          />

          <Text style={styles.label}>ID document Firestore du produit</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex. abc123XYZ (collection products)"
            value={productId}
            onChangeText={setProductId}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>URL image (optionnel, HTTPS recommandé)</Text>
          <TextInput
            style={styles.input}
            placeholder="https://…/photo.jpg"
            value={imageUrl}
            onChangeText={setImageUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.cta, sending && styles.ctaDisabled]}
            onPress={() => void onSend()}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="paper-plane" size={20} color="#fff" />
                <Text style={styles.ctaText}>Envoyer à tous les utilisateurs (token)</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8f9fa" },
  flex: { flex: 1 },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backText: { fontSize: 16, color: "#333", marginLeft: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  h1: { fontSize: 22, fontWeight: "800", color: "#1a1a1a", marginBottom: 8 },
  sub: { fontSize: 13, color: "#64748b", lineHeight: 19, marginBottom: 20 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0f172a",
  },
  multiline: { minHeight: 88, textAlignVertical: "top" },
  cta: {
    marginTop: 28,
    backgroundColor: "#FF6A00",
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  denied: { padding: 24, fontSize: 16, color: "#64748b" },
});
