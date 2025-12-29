import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Link } from "expo-router";

export default function PaymentScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons name="card" size={28} color="#FF6B00" />
        <Text style={styles.title}>Ã°Å¸â€™Â³ Paiements</Text>
      </View>
      
      <Text style={styles.subtitle}>
        GÃƒÂ©rez vos moyens de paiement et consultez vos transactions.
      </Text>

      {/* Actions avec Link */}
      <View style={styles.actions}>
        <Link href=".." asChild>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="arrow-back" size={18} color="#FFF" />
            <Text style={styles.actionText}>Retour</Text>
          </TouchableOpacity>
        </Link>
        
        <Link href="/(tabs)" asChild>
          <TouchableOpacity style={[styles.actionBtn, styles.secondary]}>
            <MaterialIcons name="home-filled" size={18} color="#FF6B00" />
            <Text style={styles.secondaryText}>Accueil</Text>
          </TouchableOpacity>
        </Link>
      </View>

      {/* Liste des cartes */}
      <View style={styles.cards}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.card}>
            <View style={styles.cardIcon}>
              <Ionicons name="card" size={20} color="#FF6B00" />
            </View>
            
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Ã°Å¸â€™Â³ Paiements #{i}</Text>
              <Text style={styles.cardSub}>Exemple de contenu illustratif.</Text>
            </View>
            
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#F8F9FA" 
  },
  content: { 
    padding: 16, 
    paddingBottom: 32 
  },
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 8, 
    marginBottom: 8 
  },
  title: { 
    fontSize: 22, 
    fontWeight: "800", 
    color: "#1A1A1A" 
  },
  subtitle: { 
    fontSize: 14, 
    color: "#666", 
    marginBottom: 16 
  },
  actions: { 
    flexDirection: "row", 
    gap: 12, 
    marginBottom: 12 
  },
  actionBtn: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 8, 
    backgroundColor: "#FF6B00", 
    paddingVertical: 10, 
    paddingHorizontal: 14, 
    borderRadius: 10 
  },
  actionText: { 
    color: "#FFF", 
    fontWeight: "700" 
  },
  secondary: { 
    backgroundColor: "#FFF", 
    borderWidth: 1, 
    borderColor: "#FFE0CC" 
  },
  secondaryText: { 
    color: "#FF6B00", 
    fontWeight: "700" 
  },
  cards: { 
    gap: 10 
  },
  card: { 
    flexDirection: "row", 
    alignItems: "center", 
    backgroundColor: "#FFF", 
    padding: 12, 
    borderRadius: 12, 
    gap: 12, 
    borderWidth: 1, 
    borderColor: "#F0F0F0", 
    shadowColor: "#000", 
    shadowOpacity: 0.05, 
    shadowRadius: 4, 
    shadowOffset: { width: 0, height: 2 }, 
    elevation: 2 
  },
  cardIcon: { 
    width: 36, 
    height: 36, 
    borderRadius: 8, 
    backgroundColor: "#FFF3E8", 
    alignItems: "center", 
    justifyContent: "center" 
  },
  cardTitle: { 
    fontSize: 15, 
    fontWeight: "700", 
    color: "#1A1A1A" 
  },
  cardSub: { 
    fontSize: 12, 
    color: "#777" 
  },
});
