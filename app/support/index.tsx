import React, { useMemo, useState } from "react";
import {
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

type HelpCategory = {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  questions: string[];
};

type ContactMethod = {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  availability: string;
  action: () => void;
};

const CONTACT_EMAIL = "adexpress65.app@gmail.com";
const CONTACT_PHONE_1 = "+22370030384";
const CONTACT_PHONE_2 = "+22360030384";

async function openExternal(url: string): Promise<void> {
  const can = await Linking.canOpenURL(url);
  if (can) {
    await Linking.openURL(url);
  }
}

export default function SupportScreen() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState("general");

  const categories = useMemo<HelpCategory[]>(
    () => [
      {
        id: "general",
        title: "Questions generales",
        icon: "help-circle-outline",
        questions: [
          "Comment creer un compte ?",
          "Comment passer une commande ?",
          "Quels sont les modes de paiement ?",
          "Comment suivre ma commande ?",
        ],
      },
      {
        id: "delivery",
        title: "Livraison",
        icon: "car-outline",
        questions: [
          "Delais de livraison",
          "Frais de livraison",
          "Zones de livraison",
          "Probleme de livraison",
        ],
      },
      {
        id: "returns",
        title: "Retours et remboursements",
        icon: "swap-horizontal-outline",
        questions: [
          "Politique de retour",
          "Comment retourner un produit ?",
          "Delai de remboursement",
          "Produit endommage",
        ],
      },
      {
        id: "account",
        title: "Compte et securite",
        icon: "person-outline",
        questions: [
          "Modifier mon profil",
          "Probleme de connexion",
          "Mot de passe oublie",
          "Securite du compte",
        ],
      },
    ],
    []
  );

  const contactMethods = useMemo<ContactMethod[]>(
    () => [
      {
        title: "Chat en direct",
        description: "Discussion instantanee avec l'equipe A2Express",
        icon: "chatbubble-ellipses-outline",
        availability: "Disponible 24/7",
        action: () => router.push("/support/support"),
      },
      {
        title: "Email",
        description: CONTACT_EMAIL,
        icon: "mail-outline",
        availability: "Reponse sous 24h",
        action: () => {
          void openExternal(`mailto:${CONTACT_EMAIL}`);
        },
      },
      {
        title: "Telephone 1",
        description: CONTACT_PHONE_1,
        icon: "call-outline",
        availability: "Lun-Dim 8h-20h",
        action: () => {
          void openExternal(`tel:${CONTACT_PHONE_1}`);
        },
      },
      {
        title: "Telephone 2",
        description: CONTACT_PHONE_2,
        icon: "call-outline",
        availability: "Lun-Dim 8h-20h",
        action: () => {
          void openExternal(`tel:${CONTACT_PHONE_2}`);
        },
      },
    ],
    [router]
  );

  const currentCategory = categories.find((cat) => cat.id === activeCategory);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Centre d'aide A2Express</Text>
        <TouchableOpacity>
          <Ionicons name="search" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher dans l'aide..."
              placeholderTextColor="#999"
            />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryButton,
                activeCategory === category.id && styles.categoryButtonActive,
              ]}
              onPress={() => setActiveCategory(category.id)}
            >
              <Ionicons
                name={category.icon}
                size={20}
                color={activeCategory === category.id ? "#FF6B00" : "#666"}
              />
              <Text
                style={[
                  styles.categoryText,
                  activeCategory === category.id && styles.categoryTextActive,
                ]}
              >
                {category.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {currentCategory ? (
          <View style={styles.faqSection}>
            <Text style={styles.sectionTitle}>Questions frequentes</Text>
            {currentCategory.questions.map((question) => (
              <TouchableOpacity key={question} style={styles.faqItem}>
                <Text style={styles.faqQuestion}>{question}</Text>
                <Ionicons name="chevron-forward" size={16} color="#999" />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>Contactez A2Express</Text>
          {contactMethods.map((method) => (
            <TouchableOpacity
              key={method.title}
              style={styles.contactMethod}
              onPress={method.action}
            >
              <View style={styles.contactIcon}>
                <Ionicons name={method.icon} size={24} color="#FF6B00" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactTitle}>{method.title}</Text>
                <Text style={styles.contactDescription}>{method.description}</Text>
                <Text style={styles.contactAvailability}>{method.availability}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#999" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.emergencyCard}>
          <View style={styles.emergencyHeader}>
            <Ionicons name="warning-outline" size={24} color="#FF6B00" />
            <Text style={styles.emergencyTitle}>Besoin d'aide urgente ?</Text>
          </View>
          <Text style={styles.emergencyText}>
            Pour un probleme urgent de commande ou de securite, contactez
            immediatement A2Express via l'un des numeros ci-dessus.
          </Text>
          <TouchableOpacity
            style={styles.emergencyButton}
            onPress={() => {
              void openExternal(`tel:${CONTACT_PHONE_1}`);
            }}
          >
            <Text style={styles.emergencyButtonText}>Contacter en urgence</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  searchSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  categoriesScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginRight: 8,
    minWidth: 140,
  },
  categoryButtonActive: {
    backgroundColor: '#FFF8F0',
    borderWidth: 1,
    borderColor: '#FF6B00',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 6,
  },
  categoryTextActive: {
    color: '#FF6B00',
  },
  faqSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  faqItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  faqQuestion: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  contactSection: {
    padding: 16,
  },
  contactMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  contactDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  contactAvailability: {
    fontSize: 12,
    color: '#999',
  },
  emergencyCard: {
    backgroundColor: '#FFF8F0',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  emergencyText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  emergencyButton: {
    backgroundColor: '#FF6B00',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  emergencyButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
