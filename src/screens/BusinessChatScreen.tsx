// src/screens/BusinessChatScreen.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useBusinessMessaging } from '../hooks/useBusinessMessaging';
import { BusinessMessage, Conversation } from '../services/firebase/messagingService';

const { width } = Dimensions.get('window');

export const BusinessChatScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { conversationId } = route.params as { conversationId: string };
  
  const {
    businessConversations,
    messages,
    selectedConversation,
    isSending,
    selectConversation,
    sendMessage,
    createSupportTicket,
    updateOrderStatus,
    markAsRead,
  } = useBusinessMessaging();
  
  const [messageText, setMessageText] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [showOrderActions, setShowOrderActions] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  
  // Charger la conversation
  useEffect(() => {
    const conversation = businessConversations.find(c => c.id === conversationId);
    if (conversation) {
      selectConversation(conversation);
      markAsRead();
    }
  }, [conversationId, businessConversations, selectConversation, markAsRead]);
  
  // Faire défiler vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);
  
  // Envoyer un message
  const handleSendMessage = useCallback(async () => {
    if (!messageText.trim() || isSending) return;
    
    await sendMessage(messageText.trim());
    setMessageText('');
  }, [messageText, isSending, sendMessage]);
  
  // Rendu d'un message
  const renderMessage = useCallback(({ item }: { item: BusinessMessage }) => {
    const isUser = item.senderType === 'customer';
    const isSystem = item.senderType === 'system';
    const isBusiness = item.senderType === 'business';
    
    // Message système
    if (isSystem) {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{item.text}</Text>
          {item.metadata?.ticketNumber && (
            <Text style={styles.systemMetadata}>
              Ticket: {item.metadata.ticketNumber}
            </Text>
          )}
        </View>
      );
    }
    
    // Message de commande
    if (item.type === 'order') {
      return (
        <View style={[
          styles.orderMessageContainer,
          isUser ? styles.userOrderMessage : styles.businessOrderMessage
        ]}>
          <View style={styles.orderHeader}>
            <Ionicons 
              name={isUser ? 'cart-outline' : 'business'} 
              size={20} 
              color={isUser ? '#007AFF' : '#4CAF50'} 
            />
            <Text style={styles.orderTitle}>
              {isUser ? 'Votre commande' : 'Mise à jour commande'}
            </Text>
          </View>
          
          {item.metadata?.orderId && (
            <Text style={styles.orderId}>#{item.metadata.orderId}</Text>
          )}
          
          <Text style={styles.orderText}>{item.text}</Text>
          
          {item.metadata?.amount && (
            <View style={styles.orderDetail}>
              <Text style={styles.orderDetailLabel}>Montant:</Text>
              <Text style={styles.orderDetailValue}>{item.metadata.amount}</Text>
            </View>
          )}
          
          {item.metadata?.status && (
            <View style={styles.orderDetail}>
              <Text style={styles.orderDetailLabel}>Statut:</Text>
              <Text style={[
                styles.orderDetailValue,
                styles[`status${item.metadata.status}`]
              ]}>
                {item.metadata.status}
              </Text>
            </View>
          )}
          
          {item.metadata?.trackingNumber && (
            <TouchableOpacity style={styles.trackingButton}>
              <Ionicons name="locate" size={16} color="#007AFF" />
              <Text style={styles.trackingText}>
                Suivi: {item.metadata.trackingNumber}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }
    
    // Message normal
    return (
      <View style={[
        styles.messageContainer,
        isUser ? styles.userMessage : styles.businessMessage
      ]}>
        {!isUser && (
          <View style={styles.businessAvatar}>
            <Text style={styles.avatarText}>
              {selectedConversation?.participantAvatars[item.senderId] || '🏢'}
            </Text>
          </View>
        )}
        
        <View style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.businessBubble
        ]}>
          {!isUser && (
            <Text style={styles.senderName}>
              {item.senderName}
              {selectedConversation?.businessData?.verified && (
                <Ionicons name="checkmark-circle" size={12} color="#007AFF" style={styles.verifiedIcon} />
              )}
            </Text>
          )}
          
          <Text style={styles.messageText}>{item.text}</Text>
          
          <View style={styles.messageFooter}>
            <Text style={styles.messageTime}>
              {item.timestamp?.toDate?.().toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
            {isUser && (
              <Ionicons 
                name={item.readBy?.length > 1 ? 'checkmark-done' : 'checkmark'} 
                size={12} 
                color={item.readBy?.length > 1 ? '#4CAF50' : '#999'} 
              />
            )}
          </View>
        </View>
        
        {isUser && (
          <View style={styles.userAvatar}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
        )}
      </View>
    );
  }, [selectedConversation]);
  
  // Actions rapides
  const handleQuickAction = useCallback((action: string) => {
    switch (action) {
      case 'create_ticket':
        Alert.prompt(
          'Créer un ticket',
          'Décrivez votre problème:',
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Créer',
              onPress: async (description) => {
                if (description) {
                  await createSupportTicket({
                    subject: 'Problème technique',
                    category: 'technical',
                    priority: 'normal',
                    description
                  });
                }
              }
            }
          ]
        );
        break;
        
      case 'track_order':
        Alert.alert('Suivi de commande', 'Fonctionnalité bientôt disponible');
        break;
        
      case 'request_callback':
        sendMessage('Bonjour, je souhaiterais être rappelé pour discuter de mon problème. Merci !');
        break;
        
      case 'share_docs':
        Alert.alert('Partage de documents', 'Fonctionnalité bientôt disponible');
        break;
    }
    setShowOptions(false);
  }, [createSupportTicket, sendMessage]);
  
  // Actions de commande
  const handleOrderAction = useCallback((action: string) => {
    switch (action) {
      case 'cancel_order':
        Alert.alert(
          'Annuler la commande',
          'Êtes-vous sûr de vouloir annuler cette commande ?',
          [
            { text: 'Non', style: 'cancel' },
            {
              text: 'Oui',
              style: 'destructive',
              onPress: () => updateOrderStatus('cancelled', {
                notes: 'Annulé par le client'
              })
            }
          ]
        );
        break;
        
      case 'update_address':
        Alert.prompt(
          'Mettre à jour l\'adresse',
          'Nouvelle adresse:',
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Mettre à jour',
              onPress: (address) => {
                if (address) {
                  sendMessage(`Je souhaite mettre à jour mon adresse de livraison: ${address}`, 'text');
                }
              }
            }
          ]
        );
        break;
        
      case 'request_invoice':
        sendMessage('Bonjour, pourriez-vous m\'envoyer la facture de ma commande ? Merci.', 'text');
        break;
    }
    setShowOrderActions(false);
  }, [updateOrderStatus, sendMessage]);
  
  // Header personnalisé
  useEffect(() => {
    if (selectedConversation) {
      navigation.setOptions({
        headerTitle: () => (
          <View style={styles.headerTitle}>
            <Text style={styles.headerName}>
              {selectedConversation.title}
            </Text>
            <Text style={styles.headerStatus}>
              {selectedConversation.businessData?.status === 'online' ? '🟢 En ligne' : '⚫ Hors ligne'}
              {selectedConversation.businessData?.verified && ' • Vérifié'}
            </Text>
          </View>
        ),
        headerRight: () => (
          <TouchableOpacity 
            style={styles.headerMenuButton}
            onPress={() => setShowOptions(!showOptions)}
          >
            <Ionicons name="ellipsis-vertical" size={24} color="#007AFF" />
          </TouchableOpacity>
        ),
      });
    }
  }, [navigation, selectedConversation, showOptions]);
  
  if (!selectedConversation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Chargement de la conversation...</Text>
      </View>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            selectedConversation.businessData && (
              <View style={styles.businessInfoCard}>
                <View style={styles.businessHeader}>
                  <Text style={styles.businessAvatarLarge}>
                    {selectedConversation.participantAvatars[selectedConversation.businessData.companyId] || '🏢'}
                  </Text>
                  <View style={styles.businessInfo}>
                    <Text style={styles.businessName}>
                      {selectedConversation.title}
                      {selectedConversation.businessData.verified && (
                        <Ionicons name="checkmark-circle" size={16} color="#007AFF" />
                      )}
                    </Text>
                    <Text style={styles.businessCategory}>
                      {selectedConversation.businessData.category}
                    </Text>
                    <Text style={styles.businessResponse}>
                      ⏱️ Réponse: {selectedConversation.businessData.responseTime}
                    </Text>
                  </View>
                </View>
                
                {selectedConversation.type === 'order' && selectedConversation.shoppingData && (
                  <View style={styles.orderInfoCard}>
                    <Text style={styles.orderInfoTitle}>📦 Informations commande</Text>
                    <View style={styles.orderDetails}>
                      <View style={styles.orderDetailRow}>
                        <Text style={styles.orderDetailLabel}>Numéro:</Text>
                        <Text style={styles.orderDetailValue}>
                          {selectedConversation.shoppingData.orderId}
                        </Text>
                      </View>
                      <View style={styles.orderDetailRow}>
                        <Text style={styles.orderDetailLabel}>Statut:</Text>
                        <Text style={[
                          styles.orderDetailValue,
                          styles[`status${selectedConversation.shoppingData.orderStatus}`]
                        ]}>
                          {selectedConversation.shoppingData.orderStatus}
                        </Text>
                      </View>
                      <View style={styles.orderDetailRow}>
                        <Text style={styles.orderDetailLabel}>Montant:</Text>
                        <Text style={styles.orderDetailValue}>
                          {selectedConversation.shoppingData.totalAmount}
                        </Text>
                      </View>
                      {selectedConversation.shoppingData.estimatedDelivery && (
                        <View style={styles.orderDetailRow}>
                          <Text style={styles.orderDetailLabel}>Livraison estimée:</Text>
                          <Text style={styles.orderDetailValue}>
                            {selectedConversation.shoppingData.estimatedDelivery}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            )
          }
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <Ionicons name="chatbubble-outline" size={64} color="#CCCCCC" />
              <Text style={styles.emptyText}>Aucun message</Text>
              <Text style={styles.emptySubtext}>
                Envoyez votre premier message pour commencer la conversation
              </Text>
            </View>
          }
        />
        
        {/* Menu d'options */}
        {showOptions && (
          <View style={styles.optionsMenu}>
            <TouchableOpacity 
              style={styles.optionItem}
              onPress={() => handleQuickAction('create_ticket')}
            >
              <Ionicons name="ticket" size={20} color="#007AFF" />
              <Text style={styles.optionText}>Créer un ticket</Text>
            </TouchableOpacity>
            
            {selectedConversation.type === 'order' && (
              <TouchableOpacity 
                style={styles.optionItem}
                onPress={() => {
                  setShowOptions(false);
                  setShowOrderActions(true);
                }}
              >
                <Ionicons name="cart" size={20} color="#FF6B00" />
                <Text style={styles.optionText}>Actions commande</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.optionItem}
              onPress={() => handleQuickAction('request_callback')}
            >
              <Ionicons name="call" size={20} color="#4CAF50" />
              <Text style={styles.optionText}>Demander un rappel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.optionItem}
              onPress={() => handleQuickAction('share_docs')}
            >
              <Ionicons name="document-attach" size={20} color="#666" />
              <Text style={styles.optionText}>Partager documents</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.optionItem, styles.optionCancel]}
              onPress={() => setShowOptions(false)}
            >
              <Text style={styles.optionCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Menu actions commande */}
        {showOrderActions && (
          <View style={styles.orderActionsMenu}>
            <Text style={styles.orderActionsTitle}>Actions commande</Text>
            <TouchableOpacity 
              style={styles.orderActionItem}
              onPress={() => handleOrderAction('cancel_order')}
            >
              <Ionicons name="close-circle" size={20} color="#FF3B30" />
              <Text style={styles.orderActionText}>Annuler la commande</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.orderActionItem}
              onPress={() => handleOrderAction('update_address')}
            >
              <Ionicons name="location" size={20} color="#007AFF" />
              <Text style={styles.orderActionText}>Changer adresse</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.orderActionItem}
              onPress={() => handleOrderAction('request_invoice')}
            >
              <Ionicons name="receipt" size={20} color="#4CAF50" />
              <Text style={styles.orderActionText}>Demander facture</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.orderActionItem, styles.orderActionCancel]}
              onPress={() => setShowOrderActions(false)}
            >
              <Text style={styles.orderActionCancelText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Zone d'envoi de message */}
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton}>
            <Ionicons name="add" size={24} color="#007AFF" />
          </TouchableOpacity>
          
          <TextInput
            style={styles.textInput}
            value={messageText}
            onChangeText={setMessageText}
            placeholder="Tapez votre message..."
            placeholderTextColor="#999"
            multiline
            maxLength={1000}
            onSubmitEditing={handleSendMessage}
          />
          
          <TouchableOpacity 
            style={[
              styles.sendButton,
              (!messageText.trim() || isSending) && styles.sendButtonDisabled
            ]}
            onPress={handleSendMessage}
            disabled={!messageText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons 
                name={messageText.trim() ? "send" : "mic"} 
                size={24} 
                color="#FFFFFF" 
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  headerTitle: {
    alignItems: 'center',
  },
  headerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  headerStatus: {
    fontSize: 12,
    color: '#666',
  },
  headerMenuButton: {
    padding: 8,
    marginRight: 8,
  },
  businessInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    margin: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  businessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  businessAvatarLarge: {
    fontSize: 40,
    marginRight: 12,
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  businessCategory: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  businessResponse: {
    fontSize: 12,
    color: '#4CAF50',
  },
  orderInfoCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 12,
  },
  orderInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  orderDetails: {
    gap: 6,
  },
  orderDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  orderDetailLabel: {
    fontSize: 12,
    color: '#666',
  },
  orderDetailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  systemMessageContainer: {
    alignSelf: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginVertical: 8,
    maxWidth: '80%',
  },
  systemMessageText: {
    fontSize: 12,
    color: '#1976D2',
    textAlign: 'center',
  },
  systemMetadata: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginTop: 2,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 4,
    alignItems: 'flex-end',
  },
  userMessage: {
    justifyContent: 'flex-end',
  },
  businessMessage: {
    justifyContent: 'flex-start',
  },
  businessAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  avatarText: {
    fontSize: 16,
  },
  messageBubble: {
    maxWidth: '70%',
    padding: 12,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  businessBubble: {
    backgroundColor: '#E5E5EA',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#000',
  },
  userBubbleText: {
    color: '#FFFFFF',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    color: '#666',
    marginRight: 4,
  },
  orderMessageContainer: {
    maxWidth: '80%',
    padding: 16,
    borderRadius: 12,
    marginVertical: 8,
  },
  userOrderMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#E3F2FD',
    borderTopRightRadius: 4,
  },
  businessOrderMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3E5F5',
    borderTopLeftRadius: 4,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginLeft: 8,
  },
  orderId: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  orderText: {
    fontSize: 14,
    color: '#000',
    marginBottom: 8,
  },
  orderDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  orderDetailLabel: {
    fontSize: 12,
    color: '#666',
  },
  orderDetailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  trackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  trackingText: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 4,
  },
  statuspending: { color: '#FFA500' },
  statusprocessing: { color: '#2196F3' },
  statusshipped: { color: '#4CAF50' },
  statusdelivered: { color: '#2E7D32' },
  statuscancelled: { color: '#F44336' },
  emptyMessages: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  optionsMenu: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 200,
    zIndex: 1000,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  optionText: {
    fontSize: 14,
    color: '#000',
    marginLeft: 12,
    flex: 1,
  },
  optionCancel: {
    borderBottomWidth: 0,
    justifyContent: 'center',
  },
  optionCancelText: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
  },
  orderActionsMenu: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 200,
    zIndex: 1000,
  },
  orderActionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  orderActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  orderActionText: {
    fontSize: 14,
    color: '#000',
    marginLeft: 12,
    flex: 1,
  },
  orderActionCancel: {
    borderBottomWidth: 0,
    justifyContent: 'center',
  },
  orderActionCancelText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  attachButton: {
    padding: 8,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
    color: '#000',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
});

export default BusinessChatScreen;