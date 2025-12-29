import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function SupportScreen() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState('general');

  const categories = [
    {
      id: 'general',
      title: 'Questions GÃƒÂ©nÃƒÂ©rales',
      icon: 'help-circle-outline',
      questions: [
        'Comment crÃƒÂ©er un compte ?',
        'Comment passer une commande ?',
        'Quels sont les modes de paiement ?',
        'Comment suivre ma commande ?'
      ]
    },
    {
      id: 'delivery',
      title: 'Livraison',
      icon: 'car-outline',
      questions: [
        'DÃƒÂ©lais de livraison',
        'Frais de livraison',
        'Zones de livraison',
        'ProblÃƒÂ¨me de livraison'
      ]
    },
    {
      id: 'returns',
      title: 'Retours & Remboursements',
      icon: 'swap-horizontal-outline',
      questions: [
        'Politique de retour',
        'Comment retourner un produit ?',
        'DÃƒÂ©lai de remboursement',
        'Produit endommagÃƒÂ©'
      ]
    },
    {
      id: 'account',
      title: 'Compte & SÃƒÂ©curitÃƒÂ©',
      icon: 'person-outline',
      questions: [
        'Modifier mon profil',
        'ProblÃƒÂ¨me de connexion',
        'Mot de passe oubliÃƒÂ©',
        'SÃƒÂ©curitÃƒÂ© du compte'
      ]
    }
  ];

  const contactMethods = [
    {
      title: 'Chat en Direct',
      description: 'Discussion instantanÃƒÂ©e avec notre ÃƒÂ©quipe',
      icon: 'chatbubble-ellipses-outline',
      availability: 'Disponible 24/7',
      action: () => router.push('/support/chat')
    },
    {
      title: 'Email',
      description: 'support@assmaexpress.com',
      icon: 'mail-outline',
      availability: 'RÃƒÂ©ponse sous 24h',
      action: () => {/* Open email */}
    },
    {
      title: 'TÃƒÂ©lÃƒÂ©phone',
      description: '+212 5 22 33 44 55',
      icon: 'call-outline',
      availability: 'Lun-Ven 9h-18h',
      action: () => {/* Call phone */}
    }
  ];

  const currentCategory = categories.find(cat => cat.id === activeCategory);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Centre d'Aide</Text>
        <TouchableOpacity>
          <Ionicons name="search" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Recherche */}
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

        {/* CatÃƒÂ©gories */}
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
                activeCategory === category.id && styles.categoryButtonActive
              ]}
              onPress={() => setActiveCategory(category.id)}
            >
              <Ionicons 
                name={category.icon as any} 
                size={20} 
                color={activeCategory === category.id ? '#FF6B00' : '#666'} 
              />
              <Text style={[
                styles.categoryText,
                activeCategory === category.id && styles.categoryTextActive
              ]}>
                {category.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Questions frÃƒÂ©quentes */}
        {currentCategory && (
          <View style={styles.faqSection}>
            <Text style={styles.sectionTitle}>Questions FrÃƒÂ©quentes</Text>
            {currentCategory.questions.map((question, index) => (
              <TouchableOpacity key={index} style={styles.faqItem}>
                <Text style={styles.faqQuestion}>{question}</Text>
                <Ionicons name="chevron-forward" size={16} color="#999" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Contact */}
        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>Contactez-nous</Text>
          {contactMethods.map((method, index) => (
            <TouchableOpacity key={index} style={styles.contactMethod} onPress={method.action}>
              <View style={styles.contactIcon}>
                <Ionicons name={method.icon as any} size={24} color="#FF6B00" />
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

        {/* Urgence */}
        <View style={styles.emergencyCard}>
          <View style={styles.emergencyHeader}>
            <Ionicons name="warning-outline" size={24} color="#FF6B00" />
            <Text style={styles.emergencyTitle}>Besoin d'aide urgente ?</Text>
          </View>
          <Text style={styles.emergencyText}>
            Pour les problÃƒÂ¨mes urgents concernant votre commande ou votre sÃƒÂ©curitÃƒÂ©, contactez-nous immÃƒÂ©diatement.
          </Text>
          <TouchableOpacity style={styles.emergencyButton}>
            <Text style={styles.emergencyButtonText}>Contact Urgent</Text>
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
