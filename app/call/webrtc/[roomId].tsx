import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  FlatList,
  TextInput,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { RTCView } from 'react-native-webrtc';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useWebRTC } from '../../../src/contexts/WebRTCContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface WebRTCCallParams {
  roomId: string;
  type?: 'audio' | 'video';
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  type: 'message' | 'gift' | 'system';
  timestamp: Date;
  giftType?: string;
  giftValue?: number;
}

export default function WebRTCWatchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Partial<WebRTCCallParams>>();
  const roomId = (params.roomId as string) || '';
  const callType = (params.type as 'audio' | 'video') || 'video';

  const { user } = useAuth();
  const {
    activeCall,
    localStream,
    remoteStreams,
    endCall,
    toggleAudio,
    toggleVideo,
    switchCamera,
    startCall,
  } = useWebRTC();

  const [isJoining, setIsJoining] = useState<boolean>(true);
  const [chatMessage, setChatMessage] = useState<string>('');
  const [showGiftMenu, setShowGiftMenu] = useState<boolean>(false);
  const [liveStats, setLiveStats] = useState({
    viewersCount: 1,
    likesCount: 0,
    giftsCount: 0,
  });
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([
    { id: 'sys1', userId: '', userName: '', text: 'Appel démarré.', type: 'system', timestamp: new Date() }
  ]);
  const chatListRef = useRef<FlatList<any>>(null);
  const hasInitialized = useRef(false);

  // ✅ EFFET CORRIGÉ (SANS DOUBLON)
  useEffect(() => {
    let callTimer: NodeJS.Timeout;

    const initializeCall = async () => {
      if (hasInitialized.current) return;
      hasInitialized.current = true;

      try {
        if (!roomId) {
          Alert.alert('Erreur', 'ID de room manquant');
          router.back();
          return;
        }

        console.log('🎬 Initialisation appel:', roomId, callType);
        setIsJoining(true);

        if (!activeCall) {
          callTimer = setTimeout(async () => {
            try {
              console.log('🚀 Démarrage sécurisé...');
              await startCall(roomId, callType);
              
              setLiveMessages(prev => [...prev, {
                id: Date.now().toString(),
                userId: '',
                userName: '',
                text: 'Connecté à l\'appel.',
                type: 'system',
                timestamp: new Date()
              }]);
              setIsJoining(false);
            } catch (err: any) {
              console.error('❌ Erreur startCall:', err);
              Alert.alert('Erreur', 'Impossible de rejoindre.');
              router.back();
            }
          }, 2000);
        } else {
          setIsJoining(false);
        }
      } catch (error: any) {
        console.error('❌ Erreur:', error);
        setIsJoining(false);
        router.back();
      }
    };

    initializeCall();

    return () => {
      console.log('🧹 Cleanup écran WebRTC');
      if (callTimer) clearTimeout(callTimer);
    };
  }, [roomId, callType]);

  const handleLike = () => {
    if (!user) {
      Alert.alert('Connexion requise', 'Veuillez vous connecter pour liker');
      return;
    }
    setLiveStats(prev => ({ ...prev, likesCount: prev.likesCount + 1 }));
  };

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      userId: user?.uid || 'anon',
      userName: user?.displayName || 'Anonyme',
      text: chatMessage.trim(),
      type: 'message',
      timestamp: new Date(),
    };
    setLiveMessages(prev => [...prev, newMessage]);
    setChatMessage('');
    setTimeout(() => chatListRef.current?.scrollToEnd(), 100);
  };

  const handleSendGift = (type: string, value: number) => {
    const giftMsg: ChatMessage = {
      id: Date.now().toString(),
      userId: user?.uid || 'anon',
      userName: user?.displayName || 'Anonyme',
      text: `a envoyé ${type}`,
      type: 'gift',
      giftType: type,
      giftValue: value,
      timestamp: new Date(),
    };
    setLiveMessages(prev => [...prev, giftMsg]);
    setShowGiftMenu(false);
  };

  const handleEndCallPress = async () => {
    console.log('📴 Bouton quitter pressé');
    await endCall();
    router.back();
  };

  const renderChatMessage = ({ item }: { item: ChatMessage }) => {
    const isGift = item.type === 'gift';
    const isSystem = item.type === 'system';
    const isCurrentUser = item.userId === user?.uid;

    if (isSystem) {
      return (
        <View style={styles.systemMessage}>
          <Text style={styles.systemMessageText}>{item.text}</Text>
        </View>
      );
    }

    if (isGift) {
      return (
        <View style={styles.giftMessage}>
          <Text style={styles.giftMessageText}>
            🎁 {item.userName} a envoyé {item.giftType} ({item.giftValue} coins)
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.messageBubble, isCurrentUser && styles.currentUserMessage]}>
        <Text style={styles.userName}>{item.userName}</Text>
        <Text style={styles.messageText}>{item.text}</Text>
      </View>
    );
  };

  if (isJoining || !activeCall) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <ActivityIndicator size="large" color="#FF375F" />
        <Text style={styles.loadingText}>
          {isJoining ? 'Connexion à l\'appel...' : 'Initialisation...'}
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />

        <View style={styles.videoContainer}>
          {remoteStreams.size > 0 ? (
            Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
              <RTCView
                key={peerId}
                streamURL={stream.toURL()}
                style={StyleSheet.absoluteFill}
                objectFit="cover"
                zOrder={0}
              />
            ))
          ) : (
            <View style={styles.videoPlaceholder}>
              <Ionicons name="videocam-off-outline" size={64} color="#666" />
              <Text style={styles.placeholderTitle}>En attente de participants...</Text>
              <Text style={styles.placeholderText}>Room: {roomId}</Text>
            </View>
          )}

          {localStream && (
            <View style={styles.localVideoContainer}>
              <RTCView
                streamURL={localStream.toURL()}
                style={styles.localVideo}
                objectFit="cover"
                mirror={true}
                zOrder={1}
              />
            </View>
          )}
        </View>

        {/* Header Overlay */}
        <SafeAreaView style={styles.headerSafeArea}>
          <View style={styles.headerOverlay}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>{activeCall?.type.toUpperCase()}</Text>
            </View>
            <Text style={styles.liveTitle} numberOfLines={1}>{user?.displayName || 'Appel'}</Text>
          </View>
        </SafeAreaView>

        {/* Contrôles à droite */}
        <SafeAreaView style={styles.actionsSafeArea}>
          <View style={styles.actionsColumn}>
            <TouchableOpacity style={styles.actionButton} onPress={toggleAudio}>
              <View style={[styles.actionIconContainer, activeCall?.isMuted && styles.controlActive]}>
                <Ionicons name={activeCall?.isMuted ? "mic-off" : "mic"} size={24} color="#fff" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={toggleVideo}>
              <View style={[styles.actionIconContainer, !activeCall?.isVideoOn && styles.controlActive]}>
                <Ionicons name={activeCall?.isVideoOn ? "videocam" : "videocam-off"} size={24} color="#fff" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={switchCamera}>
              <View style={styles.actionIconContainer}>
                <Ionicons name="camera-reverse" size={24} color="#fff" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
              <View style={styles.actionIconContainer}>
                <Ionicons name="heart" size={24} color="#FF375F" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleEndCallPress}>
              <View style={[styles.actionIconContainer, styles.closeButton]}>
                <Ionicons name="call" size={24} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </View>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Chat en bas */}
        <View style={styles.chatContainer}>
          <FlatList
            ref={chatListRef}
            data={liveMessages}
            renderItem={renderChatMessage}
            keyExtractor={(item) => item.id}
            style={styles.chatList}
            contentContainerStyle={styles.chatListContent}
          />
          <View style={styles.chatInputContainer}>
            <TextInput
              value={chatMessage}
              onChangeText={setChatMessage}
              placeholder="Message..."
              placeholderTextColor="#888"
              style={styles.chatInput}
            />
            <TouchableOpacity onPress={handleSendMessage}>
              <Ionicons name="send" size={24} color="#FF375F" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Modal Cadeaux */}
        <Modal visible={showGiftMenu} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.giftMenu}>
              <View style={styles.giftMenuHeader}>
                <Text style={styles.giftMenuTitle}>Cadeaux</Text>
                <TouchableOpacity onPress={() => setShowGiftMenu(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.giftsGrid}>
                <TouchableOpacity style={styles.giftItem} onPress={() => handleSendGift('Cœur', 10)}>
                  <Text style={styles.giftEmoji}>❤️</Text>
                  <Text style={styles.giftPrice}>10</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.giftItem} onPress={() => handleSendGift('Couronne', 100)}>
                  <Text style={styles.giftEmoji}>👑</Text>
                  <Text style={styles.giftPrice}>100</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 10 },
  videoContainer: { flex: 1 },
  videoPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' },
  placeholderTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 10 },
  placeholderText: { color: '#666', marginTop: 5 },
  localVideoContainer: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#fff',
  },
  localVideo: { width: '100%', height: '100%' },
  headerSafeArea: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerOverlay: { padding: 16, flexDirection: 'row', alignItems: 'center' },
  liveBadge: { backgroundColor: '#FF375F', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff', marginRight: 4 },
  liveText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  liveTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  actionsSafeArea: { position: 'absolute', right: 0, top: 200, bottom: 100, justifyContent: 'center' },
  actionsColumn: { paddingRight: 16 },
  actionButton: { marginBottom: 20 },
  actionIconContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  controlActive: { backgroundColor: '#FF375F' },
  closeButton: { backgroundColor: '#FF375F' },
  chatContainer: { position: 'absolute', bottom: 0, left: 0, right: 80, height: '30%', backgroundColor: 'rgba(0,0,0,0.3)' },
  chatList: { flex: 1 },
  chatListContent: { padding: 10 },
  messageBubble: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 12, marginBottom: 5, alignSelf: 'flex-start' },
  currentUserMessage: { alignSelf: 'flex-end', backgroundColor: 'rgba(255,55,95,0.4)' },
  userName: { color: '#FF375F', fontSize: 10, fontWeight: 'bold' },
  messageText: { color: '#fff', fontSize: 13 },
  systemMessage: { alignSelf: 'center', marginVertical: 5 },
  systemMessageText: { color: '#aaa', fontSize: 11 },
  giftMessage: { backgroundColor: 'rgba(255,215,0,0.2)', padding: 8, borderRadius: 12, alignSelf: 'center' },
  giftMessageText: { color: '#FFD700', fontWeight: 'bold' },
  chatInputContainer: { flexDirection: 'row', alignItems: 'center', padding: 10, borderTopWidth: 0.5, borderTopColor: '#333' },
  chatInput: { flex: 1, color: '#fff', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingHorizontal: 15, height: 40, marginRight: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  giftMenu: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  giftMenuHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  giftMenuTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  giftsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  giftItem: { alignItems: 'center' },
  giftEmoji: { fontSize: 30 },
  giftPrice: { color: '#FFD700', marginTop: 5 }
});
