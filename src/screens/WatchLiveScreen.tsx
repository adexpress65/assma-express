// src/screens/WatchLiveScreen.tsx
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
  Image
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useLive } from '@/contexts/LiveContext';

import {
  createAgoraRtcEngine,
  RtcSurfaceView,
  ClientRoleType,
  ChannelProfileType,
  IRtcEngine,
  RemoteVideoState,
  RemoteVideoStateReason,
} from 'react-native-agora';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface WatchLiveParams {
  liveId: string;
  hostName?: string;
  title?: string;
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

export default function WatchLiveScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Partial<WatchLiveParams>>();
  const liveId = (params.liveId as string) || '';

  const { user } = useAuth();
  const {
    joinLive,
    leaveLive,
    likeLive,
    sendGift,
    sendMessage,
    currentLive,
    liveStats,
    liveMessages,
  } = useLive();

  const agoraEngineRef = useRef<IRtcEngine | null>(null);
  const chatListRef = useRef<FlatList<any>>(null);

  const [isJoining, setIsJoining] = useState<boolean>(true);
  const [hasRemoteVideo, setHasRemoteVideo] = useState<boolean>(false);
  const [showGiftMenu, setShowGiftMenu] = useState<boolean>(false);
  const [chatMessage, setChatMessage] = useState<string>('');
  const [agoraError, setAgoraError] = useState<string | null>(null);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);

  const appId = 'ea81a94bdf524386aefc2506db451e31';
  const channelName = liveId || 'defaultChannel';
  const token: string | null = null;
  const uid = 0;

  useEffect(() => {
    const joinLiveSession = async () => {
      if (!liveId) {
        Alert.alert('Erreur', 'ID du live manquant');
        router.back();
        return;
      }

      try {
        setIsJoining(true);
        await joinLive(liveId);
        await initializeAgora();
      } catch (error) {
        console.error('Erreur rejoindre le live:', error);
        Alert.alert('Erreur', 'Impossible de rejoindre le live');
        router.back();
      } finally {
        setIsJoining(false);
      }
    };

    joinLiveSession();

    return () => {
      leaveLiveSession();
    };
  }, [liveId]);

  const initializeAgora = async () => {
    try {
      const agoraEngine = createAgoraRtcEngine();
      agoraEngineRef.current = agoraEngine;

      agoraEngine.initialize({ appId });
      agoraEngine.setChannelProfile(ChannelProfileType.ChannelProfileLiveBroadcasting);
      agoraEngine.setClientRole(ClientRoleType.ClientRoleAudience);
      agoraEngine.enableVideo();

      agoraEngine.addListener(
        'onUserJoined',
        (connection, remoteUidJoined: number, elapsed: number) => {
          console.log('[Agora] UserJoined:', remoteUidJoined);
          setRemoteUid(remoteUidJoined);
        }
      );

      agoraEngine.addListener(
        'onUserOffline',
        (connection, remoteUidLeft: number, reason: number) => {
          console.log('[Agora] UserOffline:', remoteUidLeft, 'reason:', reason);
          if (remoteUid === remoteUidLeft) {
            setRemoteUid(null);
            setHasRemoteVideo(false);
          }
        }
      );

      agoraEngine.addListener(
        'onRemoteVideoStateChanged',
        (
          connection,
          remoteUidChanged: number,
          state: RemoteVideoState,
          reason: RemoteVideoStateReason,
          elapsed: number
        ) => {
          console.log(
            '[Agora] RemoteVideoStateChanged:',
            remoteUidChanged,
            state,
            reason
          );

          if (state === RemoteVideoState.RemoteVideoStateDecoding) {
            setHasRemoteVideo(true);
            setRemoteUid(remoteUidChanged);
          }

          if (
            state === RemoteVideoState.RemoteVideoStateStopped ||
            state === RemoteVideoState.RemoteVideoStateFailed
          ) {
            if (remoteUid === remoteUidChanged) {
              setHasRemoteVideo(false);
            }
          }
        }
      );

      agoraEngine.addListener(
        'onFirstRemoteVideoDecoded',
        (
          connection,
          remoteUidDecoded: number,
          width: number,
          height: number,
          elapsed: number
        ) => {
          console.log(
            '[Agora] FirstRemoteVideoDecoded:',
            remoteUidDecoded,
            width,
            height
          );
          setRemoteUid(remoteUidDecoded);
          setHasRemoteVideo(true);
        }
      );

      agoraEngine.addListener('onError', (err) => {
        console.error('[Agora] Error:', err);
        setAgoraError(`Erreur Agora: ${err}`);
      });

      await agoraEngine.joinChannel(
        token ?? '',
        channelName,
        uid,
        {
          clientRoleType: ClientRoleType.ClientRoleAudience,
        }
      );

      console.log('[Agora] joinChannel OK');
    } catch (error) {
      console.error('Erreur initialisation Agora:', error);
      setAgoraError('Erreur de connexion vidéo');
    }
  };

  const leaveLiveSession = async () => {
    try {
      if (agoraEngineRef.current) {
        await agoraEngineRef.current.leaveChannel();
        agoraEngineRef.current.release();
        agoraEngineRef.current = null;
      }

      await leaveLive();
    } catch (error) {
      console.error('Erreur en quittant le live:', error);
    }
  };

  const handleLike = async () => {
    if (!user) {
      Alert.alert('Connexion requise', 'Veuillez vous connecter pour liker');
      return;
    }
    try {
      await likeLive();
    } catch (error) {
      console.error('Erreur envoi like:', error);
    }
  };

  const handleSendGift = async (giftType: string, giftValue: number) => {
    if (!user) {
      Alert.alert(
        'Connexion requise',
        'Veuillez vous connecter pour envoyer un cadeau'
      );
      return;
    }

    try {
      await sendGift(giftType, giftValue);
      setShowGiftMenu(false);
    } catch (error) {
      console.error('Erreur envoi cadeau:', error);
      Alert.alert('Erreur', "Impossible d'envoyer le cadeau");
    }
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim()) return;

    if (!user) {
      Alert.alert(
        'Connexion requise',
        'Veuillez vous connecter pour chatter'
      );
      return;
    }

    try {
      await sendMessage(chatMessage.trim());
      setChatMessage('');

      setTimeout(() => {
        chatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Erreur envoi message:', error);
      Alert.alert('Erreur', "Impossible d'envoyer le message");
    }
  };

  const renderChatMessage = ({ item }: { item: any }) => {
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
            ?? {item.userName} a envoyé {item.giftType} ({item.giftValue} coins)
          </Text>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.messageBubble,
          isCurrentUser && styles.currentUserMessage,
        ]}
      >
        <Text style={styles.userName}>{item.userName}</Text>
        <Text style={styles.messageText}>{item.text}</Text>
      </View>
    );
  };

  if (isJoining || !currentLive) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <ActivityIndicator size="large" color="#FF375F" />
        <Text style={styles.loadingText}>Connexion au live...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <View style={styles.videoContainer}>
        {hasRemoteVideo && remoteUid !== null ? (
          <RtcSurfaceView
            style={styles.videoPlayer}
            canvas={{
              uid: remoteUid,
            }}
          />
        ) : (
          <View style={styles.videoPlaceholder}>
            <Ionicons
              name="videocam-off-outline"
              size={64}
              color="#666"
            />
            <Text style={styles.placeholderTitle}>
              {currentLive.title || 'Live'}
            </Text>
            <Text style={styles.placeholderSubtitle}>
              Par {currentLive.hostName || 'Anonyme'}
            </Text>
            <Text style={styles.placeholderText}>
              En attente du flux vidéo...
            </Text>
          </View>
        )}
      </View>

      <SafeAreaView style={styles.headerSafeArea}>
        <View style={styles.headerOverlay}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>EN DIRECT</Text>
          </View>

          <Text style={styles.liveTitle} numberOfLines={1}>
            {currentLive.title || 'Live sans titre'}
          </Text>

          <Text style={styles.hostName}>
            Par {currentLive.hostName || 'Anonyme'}
          </Text>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>???</Text>
              <Text style={styles.statValue}>
                {liveStats?.viewersCount || 0}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>??</Text>
              <Text style={styles.statValue}>
                {liveStats?.likesCount || 0}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>??</Text>
              <Text style={styles.statValue}>
                {liveStats?.giftsCount || 0}
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <SafeAreaView style={styles.actionsSafeArea}>
        <View style={styles.actionsColumn}>
          <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
            <View style={styles.actionIconContainer}>
              <Ionicons
                name="heart-outline"
                size={28}
                color="#FF375F"
              />
            </View>
            <Text style={styles.actionText}>Like</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowGiftMenu(true)}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons
                name="gift-outline"
                size={28}
                color="#FFD700"
              />
            </View>
            <Text style={styles.actionText}>Cadeau</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <View style={styles.actionIconContainer}>
              <Ionicons
                name="share-social-outline"
                size={28}
                color="#FFFFFF"
              />
            </View>
            <Text style={styles.actionText}>Partager</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              leaveLiveSession();
              router.back();
            }}
          >
            <View
              style={[styles.actionIconContainer, styles.closeButton]}
            >
              <Ionicons
                name="close-outline"
                size={28}
                color="#FFFFFF"
              />
            </View>
            <Text style={styles.actionText}>Quitter</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={styles.chatContainer}>
        <FlatList
          ref={chatListRef}
          data={liveMessages}
          renderItem={renderChatMessage}
          keyExtractor={(item, index) =>
            item.id || `message-${index}`
          }
          style={styles.chatList}
          contentContainerStyle={styles.chatListContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={20}
          maxToRenderPerBatch={10}
        />

        <View style={styles.chatInputContainer}>
          <TextInput
            value={chatMessage}
            onChangeText={setChatMessage}
            placeholder="Tapez votre message..."
            placeholderTextColor="#888"
            style={styles.chatInput}
            multiline={true}
            maxLength={200}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !chatMessage.trim() && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!chatMessage.trim()}
          >
            <Ionicons
              name="send-outline"
              size={20}
              color={chatMessage.trim() ? '#FF375F' : '#666'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={showGiftMenu}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGiftMenu(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.giftMenu}>
            <View style={styles.giftMenuHeader}>
              <Text style={styles.giftMenuTitle}>
                Envoyer un cadeau
              </Text>
              <TouchableOpacity
                onPress={() => setShowGiftMenu(false)}
              >
                <Ionicons
                  name="close-outline"
                  size={24}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.giftsGrid}>
              <TouchableOpacity
                style={styles.giftItem}
                onPress={() => handleSendGift('heart', 10)}
              >
                <Text style={styles.giftEmoji}>??</Text>
                <Text style={styles.giftName}>Cœur</Text>
                <Text style={styles.giftPrice}>10 coins</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.giftItem}
                onPress={() => handleSendGift('star', 50)}
              >
                <Text style={styles.giftEmoji}>?</Text>
                <Text style={styles.giftName}>Étoile</Text>
                <Text style={styles.giftPrice}>50 coins</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.giftItem}
                onPress={() => handleSendGift('crown', 100)}
              >
                <Text style={styles.giftEmoji}>??</Text>
                <Text style={styles.giftName}>Couronne</Text>
                <Text style={styles.giftPrice}>100 coins</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {agoraError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{agoraError}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  videoPlayer: {
    flex: 1,
    width: '100%',
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 20,
  },
  placeholderTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  placeholderSubtitle: {
    color: '#CCCCCC',
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  placeholderText: {
    color: '#888888',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  headerSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  headerOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    margin: 16,
    maxWidth: screenWidth * 0.7,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF375F',
    marginRight: 6,
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  liveTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  hostName: {
    color: '#CCCCCC',
    fontSize: 14,
    marginBottom: 6,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  statIcon: {
    fontSize: 12,
    marginRight: 4,
    color: '#FFFFFF',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  actionsSafeArea: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  actionsColumn: {
    marginRight: 16,
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  closeButton: {
    backgroundColor: 'rgba(255, 55, 95, 0.8)',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  chatContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: screenHeight * 0.35,
  },
  chatList: {
    flex: 1,
    maxHeight: screenHeight * 0.25,
  },
  chatListContent: {
    padding: 12,
    paddingBottom: 4,
  },
  messageBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    maxWidth: '80%',
  },
  currentUserMessage: {
    backgroundColor: 'rgba(255, 55, 95, 0.3)',
    alignSelf: 'flex-end',
  },
  userName: {
    color: '#CCCCCC',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  messageText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  systemMessage: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  systemMessageText: {
    color: '#CCCCCC',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  giftMessage: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  giftMessageText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  chatInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    maxHeight: 80,
  },
  sendButton: {
    marginLeft: 8,
    padding: 10,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  giftMenu: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  giftMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  giftMenuTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  giftsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  giftItem: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 100,
  },
  giftEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  giftName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  giftPrice: {
    color: '#FFD700',
    fontSize: 12,
  },
  errorBanner: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 55, 95, 0.9)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});