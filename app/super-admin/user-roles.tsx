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
import { useAuth } from "@/contexts/AuthContext";
import {
  ASSIGNABLE_UI_ROLE_LABELS,
  ASSIGNABLE_UI_ROLES,
  assignUserRole,
  formatRoleLabel,
  formatRoleSyncSummary,
  lookupUserByEmailInFirestore,
  mapCallableErrorToMessage,
  type AssignableUiRole,
  type UserLookupResult,
} from "@/lib/userRoleManagement";

function pickDefaultAssignableRole(user: UserLookupResult): AssignableUiRole {
  const authoritative = user.claimRole ?? user.firestoreRole;
  if (ASSIGNABLE_UI_ROLES.includes(authoritative as AssignableUiRole)) {
    return authoritative as AssignableUiRole;
  }
  return "customer";
}

export default function UserRolesScreen() {
  const router = useRouter();
  const { userRole } = useAuth();
  const [emailQuery, setEmailQuery] = useState("");
  const [foundUser, setFoundUser] = useState<UserLookupResult | null>(null);
  const [selectedRole, setSelectedRole] = useState<AssignableUiRole>("customer");
  const [searching, setSearching] = useState(false);
  const [assigning, setAssigning] = useState(false);

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

  const onSearch = async () => {
    setSearching(true);
    setFoundUser(null);

    try {
      const user = await lookupUserByEmailInFirestore(emailQuery);
      if (!user) {
        Alert.alert(
          "Aucun compte",
          "Aucun compte actif trouvé avec cet email. Seuls les comptes déjà inscrits via l'app sont gérés ici.",
        );
        return;
      }
      setFoundUser(user);
      setSelectedRole(pickDefaultAssignableRole(user));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur lors de la recherche.";
      Alert.alert("Erreur", msg);
    } finally {
      setSearching(false);
    }
  };

  const onValidate = () => {
    if (!foundUser) return;

    if (foundUser.claimRole === selectedRole) {
      Alert.alert(
        "Information",
        `ℹ️ Le claim Auth indique déjà « ${formatRoleLabel(selectedRole)} » pour ${foundUser.email}. Aucun appel setUserRole nécessaire.`,
      );
      return;
    }

    Alert.alert(
      "Confirmer l'attribution",
      `Attribuer le rôle ${formatRoleLabel(selectedRole)} au claim Auth de ${foundUser.email} ?${
        foundUser.isDesynced ? `\n\n${formatRoleSyncSummary(foundUser)}` : ""
      }`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Confirmer",
          onPress: () => void onConfirmAssign(foundUser),
        },
      ],
    );
  };

  const onConfirmAssign = async (user: UserLookupResult) => {
    setAssigning(true);
    try {
      const result = await assignUserRole(user.uid, selectedRole);

      const refreshed = await lookupUserByEmailInFirestore(
        user.email || emailQuery,
      );
      if (refreshed) {
        setFoundUser(refreshed);
        setSelectedRole(pickDefaultAssignableRole(refreshed));
      }

      Alert.alert(
        "✓ Attribution confirmée",
        `setUserRole a écrit « ${formatRoleLabel(result.role)} » sur le claim Auth de ${user.email}.\n\n${
          result.note ||
          "L'utilisateur cible doit se reconnecter (ou rafraîchir sa session) pour appliquer le nouveau claim."
        }`,
      );
    } catch (e: unknown) {
      Alert.alert("Erreur", mapCallableErrorToMessage(e));
    } finally {
      setAssigning(false);
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
          <Text style={styles.h1}>Utilisateurs / rôles</Text>
          <Text style={styles.sub}>
            Recherchez un compte existant par email et attribuez un rôle via setUserRole.
            Le claim Auth est la source de vérité ; Firestore est un miroir.
          </Text>

          <Text style={styles.label}>Adresse email</Text>
          <TextInput
            style={styles.input}
            placeholder="email@exemple.com"
            value={emailQuery}
            onChangeText={setEmailQuery}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />

          <TouchableOpacity
            style={[styles.ctaSecondary, searching && styles.ctaDisabled]}
            onPress={() => void onSearch()}
            disabled={searching}
          >
            {searching ? (
              <ActivityIndicator color="#2563EB" />
            ) : (
              <>
                <Ionicons name="search" size={18} color="#2563EB" />
                <Text style={styles.ctaSecondaryText}>Chercher</Text>
              </>
            )}
          </TouchableOpacity>

          {foundUser && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Compte trouvé</Text>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Email</Text>
                <Text style={styles.metaValue}>{foundUser.email || "—"}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Nom</Text>
                <Text style={styles.metaValue}>{foundUser.displayName}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>UID</Text>
                <Text style={styles.metaMono}>{foundUser.uid}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Firestore</Text>
                <Text style={styles.metaValue}>
                  {formatRoleLabel(foundUser.firestoreRole)}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Claim Auth</Text>
                <Text style={styles.metaValue}>
                  {foundUser.claimRole
                    ? formatRoleLabel(foundUser.claimRole)
                    : "absent"}
                </Text>
              </View>

              {foundUser.isDesynced && (
                <View style={styles.desyncBanner}>
                  <Ionicons name="warning" size={16} color="#b45309" />
                  <Text style={styles.desyncText}>
                    {formatRoleSyncSummary(foundUser)}
                  </Text>
                </View>
              )}

              <Text style={[styles.label, styles.roleLabel]}>Nouveau rôle</Text>
              <View style={styles.roleRow}>
                {ASSIGNABLE_UI_ROLES.map((role) => {
                  const active = selectedRole === role;
                  return (
                    <TouchableOpacity
                      key={role}
                      style={[styles.roleChip, active && styles.roleChipActive]}
                      onPress={() => setSelectedRole(role)}
                    >
                      <Text
                        style={[styles.roleChipText, active && styles.roleChipTextActive]}
                      >
                        {ASSIGNABLE_UI_ROLE_LABELS[role]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.cta, assigning && styles.ctaDisabled]}
                onPress={onValidate}
                disabled={assigning}
              >
                {assigning ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.ctaText}>Valider l'attribution</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
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
  ctaSecondary: {
    marginTop: 16,
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaSecondaryText: { color: "#2563EB", fontSize: 15, fontWeight: "700" },
  card: {
    marginTop: 24,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },
  metaRow: { marginBottom: 10 },
  metaLabel: { fontSize: 12, color: "#64748b", marginBottom: 2 },
  metaValue: { fontSize: 14, color: "#0f172a" },
  metaMono: {
    fontSize: 12,
    color: "#334155",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
  },
  desyncBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#fff7ed",
    borderColor: "#fdba74",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  desyncText: {
    flex: 1,
    fontSize: 12,
    color: "#b45309",
    lineHeight: 17,
  },
  roleLabel: { marginTop: 16 },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  roleChipActive: {
    borderColor: "#2563EB",
    backgroundColor: "#eff6ff",
  },
  roleChipText: { fontSize: 13, color: "#475569", fontWeight: "600" },
  roleChipTextActive: { color: "#2563EB" },
  cta: {
    marginTop: 20,
    backgroundColor: "#2563EB",
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
