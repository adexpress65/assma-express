import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

type Props = {
  /** Gardé pour la compatibilité, mais affichera toujours "Gratuit" */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Badge vert « Gratuit » pour les articles de la boutique Zéro Dollars.
 */
export default function ZeroDollarsFreeBadge({ compact, style }: Props) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact, style]}>
      <Text style={[styles.text, compact && styles.textCompact]} numberOfLines={1}>
        {/* MODIFICATION ICI : On affiche uniquement "Gratuit" dans tous les cas */}
        Gratuit
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
    // MODIFICATION ICI : Suppression du maxWidth pour laisser le mot s'afficher en entier
  },
  wrapCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  text: {
    color: "#fff",
    fontSize: 11, // Taille idéale pour l'accueil
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  textCompact: {
    fontSize: 10, // Légèrement augmenté pour la lisibilité
    fontWeight: "800",
  },
});