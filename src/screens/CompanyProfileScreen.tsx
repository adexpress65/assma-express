// apps/mobile/src/screens/CompanyProfileScreen.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, Text, ScrollView, Image, TouchableOpacity, 
  StyleSheet, FlatList 
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import ProductCard from '../components/common/ProductCard';

export default function CompanyProfileScreen() {
  const route = useRoute();
  const { companyId } = route.params;
  
  const [company, setCompany] = useState(null);
  const [products, setProducts] = useState([]);
  const [activeSection, setActiveSection] = useState('products');

  useEffect(() => {
    fetchCompanyData();
  }, [companyId]);

  const fetchCompanyData = async () => {
    try {
      const companyDoc = await getDoc(doc(db, 'suppliers', companyId));
      if (companyDoc.exists()) {
        setCompany({ id: companyDoc.id, ...companyDoc.data() });
      }

      const productsQuery = query(
        collection(db, 'products'), 
        where('supplierId', '==', companyId),
        limit(8)
      );
      const productsSnapshot = await getDocs(productsQuery);
      const companyProducts = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setProducts(companyProducts);
    } catch (error) {
      console.error('Error fetching company data:', error);
    }
  };

  if (!company) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Chargement du profil...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      
      {/* En-tête entreprise */}
      <View style={styles.companyHeader}>
        <Image 
          source={{ uri: company.logo }} 
          style={styles.companyLogo}
        />
        <View style={styles.companyInfo}>
          <Text style={styles.companyName}>{company.name}</Text>
          <Text style={styles.companyType}>
            {company.businessType || 'Manufacturer/Trading Company'}
          </Text>
          <View style={styles.companyDetails}>
            <Text style={styles.companyDetail}>📍 {company.location || 'China'}</Text>
            <Text style={styles.companyDetail}>🏭 Depuis {company.establishedYear || 2010}</Text>
          </View>
        </View>
      </View>

      {/* Métriques entreprise */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{company.rating || 4.8}</Text>
          <Text style={styles.metricLabel}>Note globale</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{company.employees || '201-500'}</Text>
          <Text style={styles.metricLabel}>Employés</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{company.certifications || 12}+</Text>
          <Text style={styles.metricLabel}>Certifications</Text>
        </View>
      </View>

      {/* Navigation sections */}
      <View style={styles.sectionsContainer}>
        {[
          { id: 'products', label: 'Produits principaux', icon: 'cube-outline' },
          { id: 'details', label: 'Détails entreprise', icon: 'business-outline' },
          { id: 'certifications', label: 'Certifications', icon: 'ribbon-outline' }
        ].map((section) => (
          <TouchableOpacity
            key={section.id}
            style={[styles.sectionTab, activeSection === section.id && styles.activeSectionTab]}
            onPress={() => setActiveSection(section.id)}
          >
            <Ionicons 
              name={section.icon} 
              size={20} 
              color={activeSection === section.id ? '#FF6A00' : '#6B6B6B'} 
            />
            <Text style={[
              styles.sectionText, 
              activeSection === section.id && styles.activeSectionText
            ]}>
              {section.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contenu des sections */}
      {activeSection === 'products' && (
        <View style={styles.productsSection}>
          <Text style={styles.sectionTitle}>Produits principaux</Text>
          <FlatList
            data={products}
            renderItem={({ item }) => (
              <View style={styles.productItem}>
                <ProductCard 
                  product={item}
                  variant="grid"
                  onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
                />
              </View>
            )}
            keyExtractor={(item) => item.id}
            numColumns={2}
            scrollEnabled={false}
            columnWrapperStyle={styles.productsRow}
          />
        </View>
      )}

      {activeSection === 'details' && (
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Informations entreprise</Text>
          
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Type d'activité:</Text>
            <Text style={styles.detailValue}>{company.businessType || 'Manufacturer'}</Text>
          </View>
          
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Adresse:</Text>
            <Text style={styles.detailValue}>{company.address || 'Industrial Zone, Shanghai, China'}</Text>
          </View>
          
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Année de création:</Text>
            <Text style={styles.detailValue}>{company.establishedYear || 2010}</Text>
          </View>
          
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Marchés principaux:</Text>
            <Text style={styles.detailValue}>{company.mainMarkets || 'Afrique, Europe, Amérique du Nord'}</Text>
          </View>
          
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Gammes de produits:</Text>
            <Text style={styles.detailValue}>{company.productRanges || 'Électronique, Téléphonie, Accessoires'}</Text>
          </View>
        </View>
      )}

      {activeSection === 'certifications' && (
        <View style={styles.certificationsSection}>
          <Text style={styles.sectionTitle}>Certifications</Text>
          {company.certificationsList?.map((cert, index) => (
            <View key={index} style={styles.certificationItem}>
              <Ionicons name="shield-checkmark" size={20} color="#4CAF50" />
              <Text style={styles.certificationText}>{cert}</Text>
            </View>
          )) || (
            <Text style={styles.noCertifications}>
              Certifications en cours de vérification
            </Text>
          )}
        </View>
      )}

      {/* CTA Demander un devis */}
      <TouchableOpacity style={styles.quoteButton}>
        <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
        <Text style={styles.quoteButtonText}>Demander un devis</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  companyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F7F7F7',
  },
  companyLogo: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222222',
    marginBottom: 4,
  },
  companyType: {
    fontSize: 16,
    color: '#FF6A00',
    marginBottom: 8,
  },
  companyDetails: {
    marginTop: 4,
  },
  companyDetail: {
    fontSize: 12,
    color: '#6B6B6B',
    marginBottom: 2,
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222222',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B6B6B',
  },
  sectionsContainer: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sectionTab: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  activeSectionTab: {
    backgroundColor: '#FFF5F0',
  },
  sectionText: {
    fontSize: 12,
    color: '#6B6B6B',
    marginTop: 4,
    textAlign: 'center',
  },
  activeSectionText: {
    color: '#FF6A00',
    fontWeight: '600',
  },
  productsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 16,
  },
  productsRow: {
    justifyContent: 'space-between',
  },
  productItem: {
    width: '48%',
    marginBottom: 16,
  },
  detailsSection: {
    padding: 16,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B6B6B',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#222222',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  certificationsSection: {
    padding: 16,
  },
  certificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  certificationText: {
    fontSize: 14,
    color: '#222222',
    marginLeft: 12,
  },
  noCertifications: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 20,
  },
  quoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6A00',
    margin: 20,
    padding: 16,
    borderRadius: 12,
  },
  quoteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
