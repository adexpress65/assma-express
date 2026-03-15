// apps/mobile/app/devenir-client-industriel.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../src/config/firebase';


const COLORS = {
  primary: '#FF6A00',
  secondary: '#FF8C00',
  background: '#F8F8F8',
  white: '#FFFFFF',
  text: '#2D3748',
  lightGray: '#E2E8F0',
  industrial: '#1E293B',
};

interface FormData {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  industry: string;
  annualVolume: string;
  productInterests: string;
  message: string;
}

export default function BecomeIndustrialClientScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    country: '',
    city: '',
    industry: '',
    annualVolume: '',
    productInterests: '',
    message: '',
  });

  const industries = [
    'Import-Export',
    'Distribution',
    'Commerce de gros',
    'Industrie manufacturière',
    'Construction',
    'Agroalimentaire',
    'Énergie',
    'Logistique',
    'Autre',
  ];

  const handleSubmit = async () => {
    // Validation
    if (!formData.companyName || !formData.contactName || !formData.email || !formData.phone) {
      Alert.alert('Erreur', 'Veuillez remplir les champs obligatoires (*)');
      return;
    }

    if (!formData.email.includes('@')) {
      Alert.alert('Erreur', 'Veuillez entrer un email valide');
      return;
    }

    setLoading(true);
    try {
      // Save to Firestore
      await addDoc(collection(db, 'industrialClients'), {
        ...formData,
        status: 'pending',
        createdAt: new Date(),
        source: 'website_form',
        type: 'industrial',
      });

      // Send email notification (you would implement this with a cloud function)
      
      Alert.alert(
        'Demande envoyée !',
        'Votre demande a été reçue. Notre équipe commerciale vous contactera dans les 24h.',
        [{ text: 'OK', onPress: () => router.push('/') }]
      );
    } catch (error) {
      console.error('Erreur envoi formulaire:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer votre demande. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <LinearGradient
          colors={[COLORS.industrial, '#334155']}
          style={styles.header}
        >
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Devenir Client Industriel</Text>
            <Text style={styles.headerSubtitle}>Accédez à nos avantages exclusifs</Text>
          </View>
          
          <View style={styles.headerPlaceholder} />
        </LinearGradient>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Introduction */}
          <View style={styles.introSection}>
            <View style={styles.introIcon}>
              <Ionicons name="business" size={40} color={COLORS.primary} />
            </View>
            <Text style={styles.introTitle}>Pourquoi devenir client A2EXPRESS ?</Text>
            <Text style={styles.introText}>
              En tant que client industriel certifié, bénéficiez de prix préférentiels, 
              d'un support dédié, de conditions de paiement adaptées et d'un accès prioritaire 
              à nos nouveaux produits.
            </Text>
          </View>

          {/* Benefits */}
          <View style={styles.benefitsSection}>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.benefitText}>Prix compétitifs négociés</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.benefitText}>Account manager dédié</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.benefitText}>Livraison prioritaire</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.benefitText}>Conditions de paiement flexibles</Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.formSection}>
            <Text style={styles.formTitle}>Formulaire de demande</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Nom de l'entreprise <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: SARL DISTRIB INDUSTRIE"
                value={formData.companyName}
                onChangeText={(value) => handleInputChange('companyName', value)}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Personne à contacter <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Jean Dupont"
                value={formData.contactName}
                onChangeText={(value) => handleInputChange('contactName', value)}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>
                  Email professionnel <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="contact@votre-entreprise.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={formData.email}
                  onChangeText={(value) => handleInputChange('email', value)}
                />
              </View>

              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>
                  Téléphone <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="+223 XX XX XX XX"
                  keyboardType="phone-pad"
                  value={formData.phone}
                  onChangeText={(value) => handleInputChange('phone', value)}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Pays</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Mali"
                  value={formData.country}
                  onChangeText={(value) => handleInputChange('country', value)}
                />
              </View>

              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Ville</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Bamako"
                  value={formData.city}
                  onChangeText={(value) => handleInputChange('city', value)}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Secteur d'activité</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.industryScroll}
              >
                {industries.map((industry, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.industryButton,
                      formData.industry === industry && styles.industryButtonActive
                    ]}
                    onPress={() => handleInputChange('industry', industry)}
                  >
                    <Text style={[
                      styles.industryButtonText,
                      formData.industry === industry && styles.industryButtonTextActive
                    ]}>
                      {industry}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Volume d'achat annuel estimé (FCFA)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 50,000,000"
                keyboardType="numeric"
                value={formData.annualVolume}
                onChangeText={(value) => handleInputChange('annualVolume', value)}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Produits d'intérêt</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Décrivez les types de produits qui vous intéressent..."
                multiline
                numberOfLines={3}
                value={formData.productInterests}
                onChangeText={(value) => handleInputChange('productInterests', value)}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Message additionnel</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Informations supplémentaires, besoins spécifiques..."
                multiline
                numberOfLines={4}
                value={formData.message}
                onChangeText={(value) => handleInputChange('message', value)}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={loading}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.secondary]}
                style={styles.submitButtonGradient}
              >
                {loading ? (
                  <Text style={styles.submitButtonText}>Envoi en cours...</Text>
                ) : (
                  <>
                    <Ionicons name="send" size={20} color="#FFF" />
                    <Text style={styles.submitButtonText}>Envoyer ma demande</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Privacy Note */}
            <Text style={styles.privacyNote}>
              Vos informations sont traitées de manière confidentielle. 
              Elles ne seront utilisées que pour traiter votre demande.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  headerPlaceholder: {
    width: 40,
  },
  introSection: {
    padding: 24,
    alignItems: 'center',
  },
  introIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF5E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.industrial,
    marginBottom: 12,
    textAlign: 'center',
  },
  introText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  benefitsSection: {
    backgroundColor: '#F8FAFC',
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  benefitText: {
    fontSize: 14,
    color: COLORS.industrial,
    flex: 1,
  },
  formSection: {
    paddingHorizontal: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.industrial,
    marginBottom: 24,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.industrial,
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.industrial,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  industryScroll: {
    flexDirection: 'row',
  },
  industryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  industryButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  industryButtonText: {
    fontSize: 12,
    color: COLORS.industrial,
    fontWeight: '500',
  },
  industryButtonTextActive: {
    color: '#FFF',
  },
  submitButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  privacyNote: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
    fontStyle: 'italic',
  },
});
