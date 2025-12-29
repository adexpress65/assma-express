// app/(tabs)/messages.tsx
import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  FlatList, 
  TouchableOpacity, 
  TextInput,
  ScrollView,
  Dimensions,
  Animated,
  Alert,
  ActivityIndicator,
  Image
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useMessages, ConversationType } from '../../src/contexts/MessagesContext';
import { useLive } from '../../src/contexts/LiveContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function HybridMessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { 
    conversations, 
    loading, 
    setCurrentConversation,
    createDemoConversations,
    unreadCount 
  } = useMessages();

  const { activeLives } = useLive(); // SUPPRIMEZ navigateToLive d'ici

  const [activeTab, setActiveTab] = useState<'social' | 'business' | 'shopping'>('social');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [stories, setStories] = useState([
    {
      id: '1',
      name: 'Tech News',
      avatar: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=150&h=150&fit=crop&crop=face',
      hasNewStories: true,
      seen: false,
      gradient: ['#FF6B00', '#FF3D00'],
      live: true
    },
    {
      id: '2', 
      name: 'Gaming',
      avatar: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=150&h=150&fit=crop&crop=face',
      hasNewStories: true,
      seen: false,
      gradient: ['#00B4FF', '#0066FF'],
      live: false
    },
    {
      id: '3',
      name: 'Design',
      avatar: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=150&h=150&fit=crop&crop=face',
      hasNewStories: false,
      seen: true,
      gradient: ['#FF00E5', '#B300FF'],
      live: true
    },
    {
      id: '4',
      name: 'Music',
      avatar: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=150&h=150&fit=crop&crop=face',
      hasNewStories: true,
      seen: false,
      gradient: ['#00FFA3', '#00D4FF'],
      live: false
    },
    {
      id: '5',
      name: 'Sports',
      avatar: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=150&h=150&fit=crop&crop=face',
      hasNewStories: false,
      seen: true,
      gradient: ['#FFD600', '#FF6B00'],
      live: true
    },
    {
      id: '6',
      name: 'Food',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      hasNewStories: true,
      seen: false,
      gradient: ['#FF416C', '#FF4B2B'],
      live: false
    }
  ]);

  const navigateToConversation = (conversation: any) => {
    if (!conversation?.id) {
      Alert.alert('Erreur', 'Conversation invalide');
      return;
    }

    console.log('?? Navigation vers:', conversation.id);
    setCurrentConversation(conversation);
    router.push(`/conversation/${conversation.id}`);
  };

  const createNewConversation = () => {
    if (!user) {
      Alert.alert('Connexion requise', 'Veuillez vous connecter pour crÃ©er une conversation');
      return;
    }

    Alert.alert(
      'Nouvelle Conversation',
      'Choisissez le type de conversation :',
      [
        {
          text: '?? Discussion de Groupe',
          onPress: () => createDemoConversations()
        },
        {
          text: '?? Support Client',
          onPress: () => createDemoConversations()
        },
        {
          text: '?? Suivi Commande',
          onPress: () => createDemoConversations()
        },
        {
          text: 'Annuler',
          style: 'cancel'
        }
      ]
    );
  };

  // CORRECTION : DÃ©placez cette fonction ici, pas dans TikTokList
  const navigateToLive = () => {
    if (!user) {
      Alert.alert('Connexion requise', 'Veuillez vous connecter pour accÃ©der au live');
      return;
    }
    
    console.log('?? Navigation vers live');
    router.push('/live/broadcast');
  };

  const navigateToStory = (story: any) => {
    console.log('?? Navigation vers story:', story.id);
    Alert.alert('Story', `Voir la story de ${story.name}`);
    
    setStories(prev => prev.map(s => 
      s.id === story.id ? { ...s, seen: true, hasNewStories: false } : s
    ));
  };

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: activeTab === 'social' ? 0 : activeTab === 'business' ? 1 : 2,
      useNativeDriver: true,
    }).start();
  }, [activeTab]);

  useEffect(() => {
    if (!loading && conversations.length === 0 && user) {
      console.log('?? Aucune conversation, crÃ©ation de dÃ©mos...');
    }
  }, [loading, conversations.length, user]);

  const TikTokStories = () => (
    <View style={tiktokStyles.storiesSection}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={tiktokStyles.storiesContent}
      >
        <TouchableOpacity 
          style={tiktokStyles.createStoryCard}
          onPress={createNewConversation}
        >
          <View style={tiktokStyles.createStoryInner}>
            <View style={tiktokStyles.createStoryImage}>
              <Image 
                source={{ uri: user?.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face' }}
                style={tiktokStyles.createStoryAvatar}
              />
              <View style={tiktokStyles.addStoryButton}>
                <Ionicons name="add" size={16} color="#000" />
              </View>
            </View>
            <Text style={tiktokStyles.createStoryText}>Votre story</Text>
          </View>
        </TouchableOpacity>

        {stories.map((story, index) => (
          <TouchableOpacity 
            key={story.id}
            style={tiktokStyles.storyCard}
            onPress={() => navigateToStory(story)}
          >
            <View style={[
              tiktokStyles.storyRing,
              story.hasNewStories && !story.seen && tiktokStyles.storyRingNew
            ]}>
              <Image 
                source={{ uri: story.avatar }}
                style={tiktokStyles.storyAvatar}
              />
              
              {story.live && (
                <View style={tiktokStyles.liveBadge}>
                  <View style={tiktokStyles.livePulse} />
                  <Text style={tiktokStyles.liveText}>LIVE</Text>
                </View>
              )}
            </View>
            
            <Text style={tiktokStyles.storyName} numberOfLines={1}>
              {story.name}
            </Text>
            
            {story.hasNewStories && !story.seen && (
              <View style={tiktokStyles.newStoriesIndicator} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const TikTokList = () => {
    const typingAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(typingAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      
      return () => animation.stop();
    }, []);

    const socialConversations = conversations.filter(conv => 
      conv.type === 'group' || conv.type === 'channel' || conv.type === 'direct'
    );

    const renderConversationItem = ({ item, index }: { item: any; index: number }) => (
      <TouchableOpacity 
        style={[
          tiktokStyles.conversationCard,
          index % 2 === 0 ? tiktokStyles.cardEven : tiktokStyles.cardOdd,
          item.unreadCount?.[user?.uid || ''] > 0 && tiktokStyles.unreadCard
        ]}
        onPress={() => navigateToConversation(item)}
      >
        <View style={tiktokStyles.avatarSection}>
          <View style={[
            tiktokStyles.avatarRing,
            { borderColor: getGradientColor(index) }
          ]}>
            <View style={tiktokStyles.avatarContainer}>
              <Text style={tiktokStyles.avatarText}>
                {item.participantAvatars?.[Object.keys(item.participantAvatars || {})[0]] || '??'}
              </Text>
            </View>
          </View>
          
          {Math.random() > 0.5 && (
            <View style={tiktokStyles.onlineIndicator}>
              <View style={tiktokStyles.onlinePulse} />
            </View>
          )}
        </View>

        <View style={tiktokStyles.contentSection}>
          <View style={tiktokStyles.headerRow}>
            <View style={tiktokStyles.nameContainer}>
              <Text style={tiktokStyles.name}>{item.title}</Text>
              {item.type === 'group' && (
                <View style={tiktokStyles.groupBadge}>
                  <Ionicons name="people" size={12} color="#FF6B00" />
                </View>
              )}
            </View>
            <View style={tiktokStyles.timeContainer}>
              <Text style={tiktokStyles.time}>
                {formatTime(item.lastMessageTime)}
              </Text>
              {item.mute && (
                <Ionicons name="volume-mute" size={12} color="#666" />
              )}
            </View>
          </View>

          <View style={tiktokStyles.messageRow}>
            {Math.random() > 0.8 ? (
              <View style={tiktokStyles.typingContainer}>
                <View style={tiktokStyles.typingDots}>
                  <Animated.View 
                    style={[
                      tiktokStyles.typingDot,
                      { 
                        transform: [{
                          translateY: typingAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -4]
                          })
                        }]
                      }
                    ]} 
                  />
                  <Animated.View 
                    style={[
                      tiktokStyles.typingDot,
                      { 
                        transform: [{
                          translateY: typingAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -4]
                          })
                        }]
                      }
                    ]} 
                  />
                  <Animated.View 
                    style={[
                      tiktokStyles.typingDot,
                      { 
                        transform: [{
                          translateY: typingAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -4]
                          })
                        }]
                      }
                    ]} 
                  />
                </View>
                <Text style={tiktokStyles.typingText}>en train d'Ã©crire...</Text>
              </View>
            ) : (
              <Text 
                style={[
                  tiktokStyles.lastMessage, 
                  (item.unreadCount?.[user?.uid || ''] || 0) > 0 && tiktokStyles.unreadMessage
                ]}
                numberOfLines={2}
              >
                {item.lastMessage || 'Commencez la conversation ??'}
              </Text>
            )}
          </View>

          <View style={tiktokStyles.footerRow}>
            <View style={tiktokStyles.membersContainer}>
              <Text style={tiktokStyles.membersText}>
                {item.participants?.length || 1} membre(s) â€¢ {getTypeLabel(item.type)}
              </Text>
            </View>
          </View>
        </View>

        <View style={tiktokStyles.rightSection}>
          {(item.unreadCount?.[user?.uid || ''] || 0) > 0 && (
            <View style={tiktokStyles.unreadContainer}>
              <View style={tiktokStyles.unreadBadge} />
              <Text style={tiktokStyles.unreadCount}>
                {item.unreadCount?.[user?.uid || '']}
              </Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={16} color="#333" />
        </View>
      </TouchableOpacity>
    );

    if (loading) {
      return (
        <View style={tiktokStyles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={tiktokStyles.loadingText}>Chargement des conversations...</Text>
        </View>
      );
    }

    return (
      <View style={tiktokStyles.container}>
        <TikTokStories />
        
        <View style={tiktokStyles.quickActions}>
          <TouchableOpacity style={tiktokStyles.quickAction}>
            <Ionicons name="search" size={18} color="#FFFFFF" />
            <Text style={tiktokStyles.quickActionText}>Rechercher</Text>
          </TouchableOpacity>
          <TouchableOpacity style={tiktokStyles.quickAction} onPress={createNewConversation}>
            <Ionicons name="person-add" size={18} color="#FFFFFF" />
            <Text style={tiktokStyles.quickActionText}>Nouveau</Text>
          </TouchableOpacity>
          <TouchableOpacity style={tiktokStyles.quickAction} onPress={navigateToLive}>
            <Ionicons name="videocam" size={18} color="#FFFFFF" />
            <Text style={tiktokStyles.quickActionText}>Live</Text>
          </TouchableOpacity>
        </View>

        <View style={tiktokStyles.listHeader}>
          <View style={tiktokStyles.headerLeft}>
            <Text style={tiktokStyles.sectionTitle}>Messages Sociaux</Text>
            <Text style={tiktokStyles.sectionSubtitle}>
              {socialConversations.filter(conv => (conv.unreadCount?.[user?.uid || ''] || 0) > 0).length} non lus
            </Text>
          </View>
          <TouchableOpacity 
            style={tiktokStyles.filterButton}
            onPress={() => Alert.alert('Filtres', 'Filtrer les conversations')}
          >
            <Ionicons name="filter" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={socialConversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversationItem}
          style={tiktokStyles.list}
          contentContainerStyle={tiktokStyles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={tiktokStyles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={64} color="#333" />
              <Text style={tiktokStyles.emptyTitle}>Aucune conversation</Text>
              <Text style={tiktokStyles.emptySubtitle}>
                CrÃ©ez votre premiÃ¨re conversation sociale
              </Text>
              <TouchableOpacity 
                style={tiktokStyles.createButton}
                onPress={createNewConversation}
              >
                <Text style={tiktokStyles.createButtonText}>?? DÃ©marrer une conversation</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>
    );
  };

  const BusinessList = () => {
    const businessConversations = conversations.filter(conv => 
      conv.type === 'support' || conv.type === 'seller' || conv.type === 'premium' || conv.type === 'delivery'
    );

    if (loading) {
      return (
        <View style={imessageStyles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={imessageStyles.loadingText}>Chargement des conversations...</Text>
        </View>
      );
    }

    return (
      <ScrollView style={imessageStyles.container}>
        <View style={imessageStyles.sectionHeader}>
          <Text style={imessageStyles.sectionTitle}>Conversations Business</Text>
          <TouchableOpacity onPress={createNewConversation}>
            <Text style={imessageStyles.seeAllText}>Nouveau</Text>
          </TouchableOpacity>
        </View>

        {businessConversations.length === 0 ? (
          <View style={imessageStyles.emptyState}>
            <Ionicons name="business-outline" size={64} color="#666" />
            <Text style={imessageStyles.emptyTitle}>Aucune conversation business</Text>
            <Text style={imessageStyles.emptySubtitle}>
              CrÃ©ez une conversation avec notre support
            </Text>
            <TouchableOpacity 
              style={imessageStyles.createButton}
              onPress={createNewConversation}
            >
              <Text style={imessageStyles.createButtonText}>?? Contacter le support</Text>
            </TouchableOpacity>
          </View>
        ) : (
          businessConversations.map((item) => (
            <TouchableOpacity 
              key={item.id}
              style={imessageStyles.conversationItem}
              onPress={() => navigateToConversation(item)}
            >
              <View style={imessageStyles.avatarContainer}>
                <View style={[
                  imessageStyles.avatar,
                  { backgroundColor: getBusinessAvatarColor(item.type) }
                ]}>
                  <Text style={imessageStyles.avatarText}>
                    {item.participantAvatars?.[Object.keys(item.participantAvatars || {})[0]] || '??'}
                  </Text>
                </View>
              </View>

              <View style={imessageStyles.content}>
                <View style={imessageStyles.header}>
                  <View style={imessageStyles.nameContainer}>
                    <Text style={imessageStyles.name}>{item.title}</Text>
                  </View>
                  <View style={imessageStyles.rightSection}>
                    <Text style={imessageStyles.time}>
                      {formatTime(item.lastMessageTime)}
                    </Text>
                    {(item.unreadCount?.[user?.uid || ''] || 0) > 0 && (
                      <View style={imessageStyles.unreadIndicator} />
                    )}
                  </View>
                </View>

                <Text 
                  style={[
                    imessageStyles.lastMessage, 
                    (item.unreadCount?.[user?.uid || ''] || 0) > 0 && imessageStyles.unreadMessage
                  ]}
                  numberOfLines={2}
                >
                  {item.lastMessage || 'Aucun message'}
                </Text>

                <View style={imessageStyles.businessInfo}>
                  <Text style={imessageStyles.category}>
                    {getTypeLabel(item.type)}
                  </Text>
                  <Text style={imessageStyles.responseTime}>
                    RÃ©pond rapidement
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    );
  };

  const ShoppingList = () => {
    const shoppingConversations = conversations.filter(conv => 
      conv.type === 'order' || conv.type === 'promo' || conv.type === 'return' || conv.type === 'subscription'
    );

    if (loading) {
      return (
        <View style={shoppingStyles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={shoppingStyles.loadingText}>Chargement des commandes...</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={shoppingConversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={shoppingStyles.orderCard}
            onPress={() => navigateToConversation(item)}
          >
            <View style={shoppingStyles.iconContainer}>
              <View style={[
                shoppingStyles.icon,
                { backgroundColor: getOrderColor(item.type) }
              ]}>
                <Text style={shoppingStyles.iconText}>
                  {item.type === 'order' ? '??' :
                   item.type === 'promo' ? '??' :
                   item.type === 'return' ? '??' : '??'}
                </Text>
              </View>
              {(item.unreadCount?.[user?.uid || ''] || 0) > 0 && (
                <View style={shoppingStyles.unreadPulse} />
              )}
            </View>

            <View style={shoppingStyles.content}>
              <View style={shoppingStyles.header}>
                <Text style={shoppingStyles.title}>{item.title}</Text>
                <Text style={shoppingStyles.time}>
                  {formatTime(item.lastMessageTime)}
                </Text>
              </View>
              
              <Text style={shoppingStyles.message} numberOfLines={1}>
                {item.lastMessage || 'Aucun message'}
              </Text>

              <View style={shoppingStyles.footer}>
                <View style={[
                  shoppingStyles.status,
                  { backgroundColor: getStatusColor(item.type) }
                ]}>
                  <Text style={shoppingStyles.statusText}>
                    {getTypeLabel(item.type)}
                  </Text>
                </View>
                
                <TouchableOpacity 
                  style={shoppingStyles.actionButton}
                  onPress={createNewConversation}
                >
                  <Text style={shoppingStyles.actionText}>Suivre</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        )}
        style={shoppingStyles.list}
        contentContainerStyle={shoppingStyles.listContent}
        ListEmptyComponent={
          <View style={shoppingStyles.emptyState}>
            <Ionicons name="cart-outline" size={64} color="#666" />
            <Text style={shoppingStyles.emptyTitle}>Aucune commande</Text>
            <Text style={shoppingStyles.emptySubtitle}>
              Vos commandes apparaÃ®tront ici
            </Text>
            <TouchableOpacity 
              style={shoppingStyles.createButton}
              onPress={createNewConversation}
            >
              <Text style={shoppingStyles.createButtonText}>?? Simuler une commande</Text>
            </TouchableOpacity>
          </View>
        }
      />
    );
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      
      if (diff < 60000) return 'maintenant';
      if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
      if (diff < 86400000) return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    } catch (error) {
      return '';
    }
  };

  const getGradientColor = (index: number) => {
    const gradients = ['#FF6B00', '#FF3D00', '#00B4FF', '#0066FF', '#FF00E5', '#B300FF'];
    return gradients[index % gradients.length];
  };

  const getTypeLabel = (type: ConversationType) => {
    switch (type) {
      case 'support': return 'Support';
      case 'order': return 'Commande';
      case 'group': return 'Groupe';
      case 'seller': return 'Vendeur';
      case 'premium': return 'Premium';
      case 'delivery': return 'Livraison';
      case 'channel': return 'ChaÃ®ne';
      case 'direct': return 'Direct';
      case 'promo': return 'Promotion';
      case 'return': return 'Retour';
      case 'subscription': return 'Abonnement';
      default: return 'Conversation';
    }
  };

  const getBusinessAvatarColor = (type: ConversationType) => {
    const colors = {
      support: '#E8F5E8',
      seller: '#E3F2FD',
      premium: '#FFF3E0',
      delivery: '#F3E5F5',
      order: '#E3F2FD',
      group: '#F5F5F5',
      channel: '#F5F5F5',
      direct: '#F5F5F5',
      promo: '#FFEBEE',
      return: '#F3E5F5',
      subscription: '#E8F5E8'
    };
    return colors[type] || '#F5F5F5';
  };

  const getOrderColor = (type: ConversationType) => {
    const colors = {
      order: '#E3F2FD',
      promo: '#FFEBEE',
      return: '#F3E5F5',
      subscription: '#E8F5E8',
      support: '#E8F5E8',
      seller: '#E3F2FD',
      premium: '#FFF3E0',
      delivery: '#F3E5F5',
      group: '#F5F5F5',
      channel: '#F5F5F5',
      direct: '#F5F5F5'
    };
    return colors[type] || '#F5F5F5';
  };

  const getStatusColor = (type: ConversationType) => {
    const colors = {
      order: '#E3F2FD',
      promo: '#FFEBEE',
      return: '#E8F5E8',
      subscription: '#E8F5E8',
      support: '#E8F5E8',
      group: '#FFF3E0',
      seller: '#E3F2FD',
      premium: '#FFF3E0',
      delivery: '#F3E5F5',
      channel: '#F5F5F5',
      direct: '#F5F5F5'
    };
    return colors[type] || '#F5F5F5';
  };

  const HybridHeader = () => (
    <View style={headerStyles.container}>
      <View style={headerStyles.topBar}>
        <Text style={headerStyles.title}>Assma Messenger</Text>
        <View style={headerStyles.actions}>
          <TouchableOpacity 
            style={headerStyles.actionBtn}
            onPress={createNewConversation}
          >
            <Ionicons name="chatbubble-ellipses" size={22} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={headerStyles.actionBtn}
            onPress={() => setIsSearchVisible(!isSearchVisible)}
          >
            <Ionicons name="search" size={22} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {isSearchVisible && (
        <View style={headerStyles.searchContainer}>
          <TextInput
            style={headerStyles.searchInput}
            placeholder="Rechercher des conversations..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      )}
      
      <View style={headerStyles.tabContainer}>
        <TouchableOpacity 
          style={headerStyles.tab}
          onPress={() => setActiveTab('social')}
        >
          <Ionicons 
            name="flash" 
            size={20} 
            color={activeTab === 'social' ? '#000' : '#666'} 
          />
          <Text style={[
            headerStyles.tabText,
            activeTab === 'social' && headerStyles.tabTextActive
          ]}>
            Social
          </Text>
          {conversations.filter(conv => 
            (conv.type === 'group' || conv.type === 'channel' || conv.type === 'direct') && 
            (conv.unreadCount?.[user?.uid || ''] || 0) > 0
          ).length > 0 && (
            <View style={headerStyles.badge}>
              <Text style={headerStyles.badgeText}>
                {conversations.filter(conv => 
                  (conv.type === 'group' || conv.type === 'channel' || conv.type === 'direct') && 
                  (conv.unreadCount?.[user?.uid || ''] || 0) > 0
                ).length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={headerStyles.tab}
          onPress={() => setActiveTab('business')}
        >
          <Ionicons 
            name="business" 
            size={18} 
            color={activeTab === 'business' ? '#000' : '#666'} 
          />
          <Text style={[
            headerStyles.tabText,
            activeTab === 'business' && headerStyles.tabTextActive
          ]}>
            Business
          </Text>
          {conversations.filter(conv => 
            (conv.type === 'support' || conv.type === 'seller' || conv.type === 'premium' || conv.type === 'delivery') && 
            (conv.unreadCount?.[user?.uid || ''] || 0) > 0
          ).length > 0 && (
            <View style={headerStyles.badge}>
              <Text style={headerStyles.badgeText}>
                {conversations.filter(conv => 
                  (conv.type === 'support' || conv.type === 'seller' || conv.type === 'premium' || conv.type === 'delivery') && 
                  (conv.unreadCount?.[user?.uid || ''] || 0) > 0
                ).length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={headerStyles.tab}
          onPress={() => setActiveTab('shopping')}
        >
          <Ionicons 
            name="cart" 
            size={18} 
            color={activeTab === 'shopping' ? '#000' : '#666'} 
          />
          <Text style={[
            headerStyles.tabText,
            activeTab === 'shopping' && headerStyles.tabTextActive
          ]}>
            Shopping
          </Text>
          {conversations.filter(conv => 
            (conv.type === 'order' || conv.type === 'promo' || conv.type === 'return' || conv.type === 'subscription') && 
            (conv.unreadCount?.[user?.uid || ''] || 0) > 0
          ).length > 0 && (
            <View style={headerStyles.badge}>
              <Text style={headerStyles.badgeText}>
                {conversations.filter(conv => 
                  (conv.type === 'order' || conv.type === 'promo' || conv.type === 'return' || conv.type === 'subscription') && 
                  (conv.unreadCount?.[user?.uid || ''] || 0) > 0
                ).length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <Animated.View 
        style={[
          headerStyles.tabIndicator,
          {
            transform: [{
              translateX: slideAnim.interpolate({
                inputRange: [0, 1, 2],
                outputRange: [0, screenWidth/3, (screenWidth/3)*2]
              })
            }]
          }
        ]} 
      />
    </View>
  );

  if (loading && conversations.length === 0) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.loadingText}>Chargement de la messagerie...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <HybridHeader />
      
      <View style={styles.content}>
        {activeTab === 'social' && <TikTokList />}
        {activeTab === 'business' && <BusinessList />}
        {activeTab === 'shopping' && <ShoppingList />}
      </View>
    </SafeAreaView>
  );
}

// ... (les styles restent exactement les mÃªmes que dans votre code original)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
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
});

const headerStyles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingTop: 10,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    padding: 4,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    position: 'relative',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    position: 'relative',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#000000',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 20,
    backgroundColor: '#FF6B00',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: screenWidth/3,
    height: 3,
    backgroundColor: '#FF6B00',
  },
});

const tiktokStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  storiesSection: {
    backgroundColor: '#000000',
    paddingVertical: 16,
  },
  storiesContent: {
    paddingHorizontal: 12,
  },
  createStoryCard: {
    alignItems: 'center',
    marginHorizontal: 6,
    width: 80,
  },
  createStoryInner: {
    alignItems: 'center',
  },
  createStoryImage: {
    position: 'relative',
    marginBottom: 6,
  },
  createStoryAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#333',
  },
  addStoryButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  createStoryText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  storyCard: {
    alignItems: 'center',
    marginHorizontal: 6,
    width: 80,
    position: 'relative',
  },
  storyRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#333',
    marginBottom: 8,
    position: 'relative',
  },
  storyRingNew: {
    borderColor: '#FF6B00',
  },
  storyAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  liveBadge: {
    position: 'absolute',
    bottom: -4,
    left: '50%',
    transform: [{ translateX: -20 }],
    backgroundColor: '#FF0066',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  livePulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  liveText: {
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  storyName: {
    fontSize: 11,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '500',
  },
  newStoriesIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B00',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.2,
    borderBottomColor: '#333',
  },
  quickAction: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    minWidth: 80,
  },
  quickActionText: {
    fontSize: 11,
    color: '#FFFFFF',
    marginTop: 4,
    fontWeight: '500',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.2,
    borderBottomColor: '#333',
  },
  headerLeft: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#FF6B00',
    fontWeight: '500',
  },
  filterButton: {
    padding: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.2,
    borderBottomColor: '#1A1A1A',
    minHeight: 88,
  },
  cardEven: {
    backgroundColor: '#000000',
  },
  cardOdd: {
    backgroundColor: '#0A0A0A',
  },
  unreadCard: {
    backgroundColor: '#1A1A1A',
  },
  avatarSection: {
    marginRight: 14,
    position: 'relative',
  },
  avatarRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  onlinePulse: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#000000',
  },
  contentSection: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginRight: 6,
  },
  groupBadge: {
    backgroundColor: 'rgba(255, 107, 0, 0.2)',
    padding: 2,
    borderRadius: 4,
  },
  timeContainer: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  time: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    minHeight: 20,
  },
  lastMessage: {
    fontSize: 14,
    color: '#888',
    flex: 1,
    lineHeight: 18,
  },
  unreadMessage: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginRight: 8,
    height: 16,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF6B00',
  },
  typingText: {
    fontSize: 13,
    color: '#FF6B00',
    fontWeight: '500',
  },
  footerRow: {
    marginTop: 2,
  },
  membersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  membersText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '400',
  },
  rightSection: {
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  unreadBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B00',
    marginBottom: 2,
  },
  unreadCount: {
    fontSize: 9,
    color: '#FF6B00',
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
    backgroundColor: '#000000',
  },
  listContent: {
    flexGrow: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});

const imessageStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  seeAllText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  nameContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  time: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  unreadIndicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#007AFF',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
    marginBottom: 6,
  },
  unreadMessage: {
    color: '#000000',
    fontWeight: '500',
  },
  businessInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  category: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  responseTime: {
    fontSize: 11,
    color: '#007AFF',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    color: '#666',
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});

const shoppingStyles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  listContent: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  orderCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: {
    position: 'relative',
    marginRight: 12,
  },
  icon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 20,
  },
  unreadPulse: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF6B00',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
    flex: 1,
  },
  time: {
    fontSize: 12,
    color: '#666',
  },
  message: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  status: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
  },
  actionButton: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    color: '#666',
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
