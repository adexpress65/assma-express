// src/components/ConversationDetail.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SocialConversation, BusinessConversation, ShoppingConversation, TabType } from '../types/messages';

type ConversationData = SocialConversation | BusinessConversation | ShoppingConversation;

interface ConversationDetailProps {
  conversation: ConversationData;
  type: TabType;
  onBack: () => void;
}

export const ConversationDetail: React.FC<ConversationDetailProps> = ({ 
  conversation, 
  type, 
  onBack 
}) => {
  const renderSocialDetails = (conv: SocialConversation) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Informations</Text>
      <View style={styles.infoGrid}>
        <View style={styles.infoItem}>
          <Ionicons name="people" size={20} color="#FF6B00" />
          <Text style={styles.infoLabel}>Membres</Text>
          <Text style={styles.infoValue}>{conv.members.length}</Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="wifi" size={20} color={conv.online ? '#4CAF50' : '#666'} />
          <Text style={styles.infoLabel}>Statut</Text>
          <Text style={styles.infoValue}>
            {conv.online ? 'En ligne' : 'Hors ligne'}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="time" size={20} color="#FF6B00" />
          <Text style={styles.infoLabel}>Dernier vu</Text>
          <Text style={styles.infoValue}>{conv.lastSeen}</Text>
        </View>
      </View>
    </View>
  );

  const renderBusinessDetails = (conv: BusinessConversation) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Informations Professionnelles</Text>
      <View style={styles.detailsList}>
        <View style={styles.detailItem}>
          <Ionicons name="shield-checkmark" size={20} color="#007AFF" />
          <View style={styles.detailText}>
            <Text style={styles.detailLabel}>Vérification</Text>
            <Text style={styles.detailValue}>
              {conv.verified ? 'Entreprise vérifiée' : 'Non vérifiée'}
            </Text>
          </View>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="business" size={20} color="#007AFF" />
          <View style={styles.detailText}>
            <Text style={styles.detailLabel}>Catégorie</Text>
            <Text style={styles.detailValue}>{conv.category}</Text>
          </View>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="time" size={20} color="#007AFF" />
          <View style={styles.detailText}>
            <Text style={styles.detailLabel}>Temps de réponse</Text>
            <Text style={styles.detailValue}>{conv.responseTime}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderShoppingDetails = (conv: ShoppingConversation) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Détails de la commande</Text>
      <View style={styles.detailsList}>
        {conv.amount && (
          <View style={styles.detailItem}>
            <Ionicons name="cash" size={20} color="#FF6B00" />
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Montant</Text>
              <Text style={styles.detailValue}>{conv.amount}</Text>
            </View>
          </View>
        )}
        {conv.progress !== undefined && (
          <View style={styles.detailItem}>
            <Ionicons name="trending-up" size={20} color="#FF6B00" />
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Progression</Text>
              <View style={styles.progressContainer}>
                <View 
                  style={[
                    styles.progressBar, 
                    { width: `${conv.progress}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>{conv.progress}%</Text>
            </View>
          </View>
        )}
        {conv.estimatedDelivery && (
          <View style={styles.detailItem}>
            <Ionicons name="calendar" size={20} color="#FF6B00" />
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Livraison estimée</Text>
              <Text style={styles.detailValue}>{conv.estimatedDelivery}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );

  const renderDetails = () => {
    switch (type) {
      case 'social':
        return renderSocialDetails(conversation as SocialConversation);
      case 'business':
        return renderBusinessDetails(conversation as BusinessConversation);
      case 'shopping':
        return renderShoppingDetails(conversation as ShoppingConversation);
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.name}>{conversation.name}</Text>
          <Text style={styles.lastMessage}>{conversation.lastMessage}</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{conversation.avatar}</Text>
          </View>
          <Text style={styles.type}>{type}</Text>
        </View>

        {renderDetails()}

        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Actions rapides</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="chatbubble" size={24} color="#FFFFFF" />
              <Text style={styles.actionText}>Messagerie</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="call" size={24} color="#FFFFFF" />
              <Text style={styles.actionText}>Appeler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="videocam" size={24} color="#FFFFFF" />
              <Text style={styles.actionText}>Vidéo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="information-circle" size={24} color="#FFFFFF" />
              <Text style={styles.actionText}>Infos</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  avatarContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 40,
    color: '#FFFFFF',
  },
  type: {
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  detailsList: {
    gap: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    flex: 1,
    marginLeft: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: 2,
  },
  progressContainer: {
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FF6B00',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  actionsSection: {
    padding: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  actionButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    minWidth: 70,
  },
  actionText: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 4,
  },
});