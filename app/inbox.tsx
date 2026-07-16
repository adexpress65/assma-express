import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView,
  Platform
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';

// Interface pour structurer une conversation
interface Conversation {
  id: string;
  lastMessage: string;
  updatedAt: any;
  participants: string[];
  productInfo?: {
    id: string;
    name: string;
    image: string;
    hasFreeShipping?: boolean;
  };
  sellerName: string;
  sellerLogo: string;
  unreadCount: number;
}

export default function InboxScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // On cherche les conversations où l'utilisateur actuel est participant
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Conversation[];
      
      setConversations(convs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

const renderConversation = ({ item }: { item: Conversation }) => {
  return (
    <TouchableOpacity
      style={styles.convCard}
      onPress={() => {
        if (!user?.uid) return;
        router.push(`/conversation/${item.id}`);
      }}
    >
      {/* Avatar Vendeur + Mini Image Produit */}
      <View style={styles.avatarContainer}>
        <Image
          source={{ uri: item.sellerLogo || "https://via.placeholder.com/100" }}
          style={styles.sellerAvatar}
          contentFit="cover"
        />
        {item.productInfo?.image && (
          <View style={styles.productMiniatureContainer}>
            <Image
              source={{ uri: item.productInfo.image }}
              style={styles.productMiniature}
            />
          </View>
        )}
      </View>

      {/* Détails du message */}
      <View style={styles.convDetails}>
        <View style={styles.headerRow}>
          <Text style={styles.sellerName} numberOfLines={1}>
            {item.sellerName || "Fournisseur"}
          </Text>
          <Text style={styles.timeText}>
            {item.updatedAt?.toDate().toLocaleDateString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>

        <View style={styles.messageRow}>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage}
          </Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>

        {/* Rappel Livraison Gratuite */}
        {item.productInfo?.hasFreeShipping && (
          <View style={styles.freeShippingTag}>
            <Ionicons name="airplane" size={10} color="#00B050" />
            <Text style={styles.freeShippingText}>
              Livraison gratuite incluse
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Chargement de vos messages...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes Discussions</Text>
        <TouchableOpacity style={styles.searchBtn}>
          <Ionicons name="search" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderConversation}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={60} color="#CCC" />
            <Text style={styles.emptyText}>Aucune discussion pour le moment.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0'
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A' },
  searchBtn: { backgroundColor: '#F5F5F5', padding: 8, borderRadius: 20 },
  listContent: { paddingHorizontal: 15 },
  convCard: { 
    flexDirection: 'row', 
    paddingVertical: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F0F0F0',
    alignItems: 'center'
  },
  avatarContainer: { position: 'relative', marginRight: 15 },
  sellerAvatar: { width: 55, height: 55, borderRadius: 27.5, backgroundColor: '#F5F5F5' },
  productMiniatureContainer: { 
    position: 'absolute', 
    bottom: -2, 
    right: -2, 
    backgroundColor: '#FFF', 
    padding: 2, 
    borderRadius: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  productMiniature: { width: 22, height: 22, borderRadius: 4 },
  convDetails: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  sellerName: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', flex: 1 },
  timeText: { fontSize: 12, color: '#999' },
  messageRow: { flexDirection: 'row', alignItems: 'center' },
  lastMessage: { fontSize: 14, color: '#666', flex: 1 },
  unreadBadge: { backgroundColor: '#FF6A00', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  unreadText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  freeShippingTag: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 6, 
    backgroundColor: '#E8F5E9', 
    paddingHorizontal: 8, 
    paddingVertical: 2, 
    borderRadius: 10,
    alignSelf: 'flex-start'
  },
  freeShippingText: { fontSize: 10, color: '#00B050', fontWeight: '700', marginLeft: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#999', marginTop: 10, fontSize: 16 }
});
