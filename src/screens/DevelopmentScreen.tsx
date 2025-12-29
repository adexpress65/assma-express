// src/screens/DevelopmentScreen.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TabType } from '../types/messages';

interface DevelopmentScreenProps {
  type: TabType;
  onGoBack?: () => void;
}

export const DevelopmentScreen: React.FC<DevelopmentScreenProps> = ({ type, onGoBack }) => {
  const getTypeInfo = () => {
    switch (type) {
      case 'business':
        return {
          title: 'Messages Business',
          icon: 'business',
          color: '#007AFF',
          description: 'Gérez vos conversations professionnelles, contacts d\'entreprises et services clients.',
          features: [
            'Messagerie d\'entreprise sécurisée',
            'Support client en direct',
            'Documents professionnels',
            'Calendrier de rendez-vous',
            'Statistiques et rapports'
          ]
        };
      case 'shopping':
        return {
          title: 'Messages Shopping',
          icon: 'cart',
          color: '#FF6B00',
          description: 'Suivez vos commandes, discutez avec les vendeurs et gérez vos achats.',
          features: [
            'Suivi de commandes en temps réel',
            'Support vendeur',
            'Promotions personnalisées',
            'Retours et réclamations',
            'Historique d\'achats'
          ]
        };
      default:
        return {
          title: 'En développement',
          icon: 'construct',
          color: '#666',
          description: 'Cette fonctionnalité sera bientôt disponible.',
          features: []
        };
    }
  };

  const info = getTypeInfo();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onGoBack && (
          <TouchableOpacity onPress={onGoBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        <View style={styles.titleContainer}>
          <Ionicons name={info.icon as any} size={28} color={info.color} />
          <Text style={styles.title}>{info.title}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.developmentCard}>
          <Ionicons name="construct-outline" size={80} color={info.color} />
          <Text style={[styles.subtitle, { color: info.color }]}>
            En cours de développement
          </Text>
          
          <Text style={styles.description}>
            {info.description}
          </Text>

          {info.features.length > 0 && (
            <View style={styles.featuresContainer}>
              <Text style={styles.featuresTitle}>Fonctionnalités à venir :</Text>
              {info.features.map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={20} color={info.color} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.actionsContainer}>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: info.color }]}>
              <Ionicons name="notifications" size={20} color="#FFFFFF" />
              <Text style={styles.actionText}>Me notifier quand disponible</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.secondaryButton}>
              <Ionicons name="share-social" size={20} color={info.color} />
              <Text style={[styles.secondaryText, { color: info.color }]}>
                Partager avec des testeurs
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <Text style={styles.progressTitle}>Progression du développement</Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: type === 'business' ? '65%' : '45%',
                  backgroundColor: info.color 
                }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {type === 'business' ? '65%' : '45%'} complété
          </Text>
        </View>

        <View style={styles.contactContainer}>
          <Text style={styles.contactTitle}>Vous avez des suggestions ?</Text>
          <TouchableOpacity style={styles.contactButton}>
            <Ionicons name="mail" size={20} color="#FFFFFF" />
            <Text style={styles.contactButtonText}>Contactez l'équipe</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  developmentCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingLeft: 4,
  },
  featureText: {
    fontSize: 14,
    color: '#CCCCCC',
    marginLeft: 8,
    flex: 1,
  },
  actionsContainer: {
    width: '100%',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    gap: 8,
  },
  secondaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  progressContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    marginBottom: 20,
  },
  progressTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'right',
  },
  contactContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    alignItems: 'center',
  },
  contactTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  contactButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});