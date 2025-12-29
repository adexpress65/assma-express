// apps/mobile/app/live/broadcast.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  SafeAreaView,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc
} from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/contexts/AuthContext';
import {
  createAgoraRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  IRtcEngine,
  VideoSourceType,
  RenderModeType
} from "react-native-agora";

const { width, height } = Dimensions.get('window');

export default function BroadcastScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [isLive, setIsLive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [viewersCount, setViewersCount] = useState(0);
  const [liveDuration, setLiveDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [liveId, setLiveId] = useState<string | null>(null);
  const [agoraStatus, setAgoraStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  
  const agoraEngineRef = useRef<IRtcEngine | null>(null);
  const durationInterval = useRef<NodeJS.Timeout>();

  // Initialiser et libérer l'engine Agora
  useEffect(() => {
    initializeAgoraEngine();

    return () => {
      cleanupAgoraEngine();
      stopTimers();
    };
  }, []);

  const initializeAgoraEngine = async () => {
    try {
      setAgoraStatus('loading');
      
      const appId = process.env.EXPO_PUBLIC_AGORA_APP_ID;
      
      if (!appId) {
        console.error('EXPO_PUBLIC_AGORA_APP_ID non défini');
        setAgoraStatus('error');
        return;
      }

      const agoraEngine = createAgoraRtcEngine();
      
      const response = agoraEngine.initialize({
        appId,
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
      });

      console.log('Agora initialisé:', response);
      
      agoraEngineRef.current = agoraEngine;
      setAgoraStatus('ready');

    } catch (error) {
      console.error('Erreur initialisation Agora:', error);
      setAgoraStatus('error');
    }
  };

  const cleanupAgoraEngine = () => {
    if (agoraEngineRef.current) {
      try {
        agoraEngineRef.current.leaveChannel();
        agoraEngineRef.current.release();
        agoraEngineRef.current = null;
        console.log('Agora engine libéré');
      } catch (error) {
        console.error('Erreur libération Agora:', error);
      }
    }
  };

  const startAgoraLive = async () => {
    if (!agoraEngineRef.current || agoraStatus !== 'ready') {
      Alert.alert('Erreur', 'Agora SDK non disponible');
      return;
    }

    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté');
      return;
    }

    try {
      setIsLoading(true);
      console.log('Démarrage live Agora...');

      const agoraEngine = agoraEngineRef.current;

      await agoraEngine.enableVideo();
      await agoraEngine.enableAudio();

      await agoraEngine.setChannelProfile(ChannelProfileType.ChannelProfileLiveBroadcasting);
      await agoraEngine.setClientRole(ClientRoleType.ClientRoleBroadcaster);

      const channelName = `assma_live_${user.uid}_${Date.now()}`;
      console.log('Connexion canal:', channelName);

      await agoraEngine.joinChannel({
        token: null,
        channelId: channelName,
        info: null,
        uid: 0,
        options: {
          channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
          clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        }
      });

      const liveDoc = await addDoc(collection(db, 'lives'), {
        hostId: user.uid,
        hostName: user.displayName || 'Anonyme',
        hostAvatar: user.photoURL || '',
        title: `Live de ${user.displayName || 'Anonyme'}`,
        isActive: true,
        viewers: 1,
        likes: 0,
        startedAt: serverTimestamp(),
        agoraChannel: channelName,
        status: 'live',
        platform: 'agora'
      });

      setLiveId(liveDoc.id);
      setIsLive(true);
      setViewersCount(1);
      
      console.log('LIVE AGORA DÉMARRÉ:', liveDoc.id);
      startDurationTimer();
      
      Alert.alert('Live Agora Démaré!', 'Streaming haute qualité activé');

    } catch (error) {
      console.error('ERREUR AGORA:', error);
      Alert.alert(
        'Erreur Agora', 
        `Détail: ${error instanceof Error ? error.message : String(error)}\n\nVérifiez votre App ID Agora et la connexion réseau.`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const stopLiveStream = async () => {
    try {
      if (agoraEngineRef.current) {
        console.log('Arrêt Agora...');
        await agoraEngineRef.current.leaveChannel();
      }

      if (liveId) {
        await updateDoc(doc(db, 'lives', liveId), {
          isActive: false,
          endedAt: serverTimestamp(),
          duration: liveDuration
        });
      }

    } catch (error) {
      console.error('Erreur arrêt:', error);
    } finally {
      setIsLive(false);
      setLiveId(null);
      stopTimers();
      router.back();
    }
  };

  const startDurationTimer = () => {
    durationInterval.current = setInterval(() => {
      setLiveDuration(prev => prev + 1);
    }, 1000);
  };

  const stopTimers = () => {
    if (durationInterval.current) clearInterval(durationInterval.current);
  };

  const toggleMute = async () => {
    if (!agoraEngineRef.current) return;
    
    try {
      await agoraEngineRef.current.muteLocalAudioStream(!isMuted);
      setIsMuted(!isMuted);
    } catch (error) {
      console.error('Erreur mute:', error);
    }
  };

  const switchCamera = async () => {
    if (!agoraEngineRef.current) return;
    
    try {
      await agoraEngineRef.current.switchCamera();
    } catch (error) {
      console.error('Erreur switch camera:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <View style={styles.liveBadge}>
            <View style={styles.livePulse} />
            <Text style={styles.liveText}>AGORA LIVE</Text>
          </View>
          <Text style={styles.viewerCount}>{viewersCount} spectateurs</Text>
        </View>
        
        <View style={styles.statusIndicator}>
          <View style={[
            styles.statusDot,
            agoraStatus === 'ready' && styles.statusReady,
            agoraStatus === 'error' && styles.statusError
          ]} />
        </View>
      </View>

      <View style={styles.videoContainer}>
        {isLive ? (
          <View style={styles.agoraContainer}>
            {agoraEngineRef.current && (
              agoraEngineRef.current.enableVideo()
            )}
            
            <View style={styles.overlay}>
              <View style={styles.durationContainer}>
                <Text style={styles.durationText}>{formatDuration(liveDuration)}</Text>
              </View>
              
              <View style={styles.statsContainer}>
                <View style={styles.stat}>
                  <Ionicons name="eye" size={16} color="#FFF" />
                  <Text style={styles.statText}>{viewersCount}</Text>
                </View>
              </View>

              <View style={styles.liveMessageContainer}>
                <Text style={styles.liveMessage}>🔥 AGORA LIVE ACTIF</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.preview}>
            <Ionicons name="videocam" size={80} color="#666" />
            <Text style={styles.previewTitle}>Prêt pour Agora Live</Text>
            
            <View style={styles.agoraStatusContainer}>
              <Text style={styles.agoraStatusText}>
                Status: {
                  agoraStatus === 'loading' ? '🔍 Vérification...' :
                  agoraStatus === 'ready' ? '✅ Agora Prêt' :
                  '❌ Agora Non Disponible'
                }
              </Text>
              
              {agoraStatus === 'error' && (
                <Text style={styles.errorHelp}>
                  Assurez-vous d'avoir un App ID Agora valide dans EXPO_PUBLIC_AGORA_APP_ID
                </Text>
              )}
            </View>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        {!isLive ? (
          <TouchableOpacity 
            style={[
              styles.startButton, 
              (isLoading || agoraStatus !== 'ready') && styles.startButtonDisabled
            ]}
            onPress={startAgoraLive}
            disabled={isLoading || agoraStatus !== 'ready'}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="radio" size={24} color="#FFF" />
                <Text style={styles.startButtonText}>
                  {agoraStatus === 'ready' ? 'DÉMARRER AGORA' : 'AGORA INDISPONIBLE'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.liveControls}>
            <View style={styles.controlRow}>
              <TouchableOpacity style={styles.controlButton} onPress={switchCamera}>
                <Ionicons name="camera-reverse" size={24} color="#FFF" />
                <Text style={styles.controlLabel}>Caméra</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.stopButton} onPress={stopLiveStream}>
                <View style={styles.stopButtonInner}>
                  <Ionicons name="square" size={20} color="#FFF" />
                </View>
                <Text style={styles.stopLabel}>Arrêter</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.controlButton} onPress={toggleMute}>
                <Ionicons 
                  name={isMuted ? "mic-off" : "mic"} 
                  size={24} 
                  color="#FFF" 
                />
                <Text style={styles.controlLabel}>
                  {isMuted ? 'Audio' : 'Mute'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    alignItems: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF0066',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 4,
  },
  livePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
    marginRight: 6,
  },
  liveText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  viewerCount: {
    color: '#FFF',
    fontSize: 11,
    opacity: 0.8,
  },
  statusIndicator: {
    padding: 6,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#666',
  },
  statusReady: {
    backgroundColor: '#4CAF50',
  },
  statusError: {
    backgroundColor: '#FF0000',
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#111',
  },
  agoraContainer: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 16,
  },
  durationContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  durationText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statsContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    gap: 8,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  statText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  liveMessageContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  liveMessage: {
    color: '#FFF',
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  preview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  previewTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  agoraStatusContainer: {
    alignItems: 'center',
    gap: 8,
  },
  agoraStatusText: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
  },
  errorHelp: {
    color: '#FF6B00',
    fontSize: 14,
    textAlign: 'center',
  },
  controls: {
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF0066',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 12,
  },
  startButtonDisabled: {
    opacity: 0.6,
    backgroundColor: '#666',
  },
  startButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  liveControls: {
    gap: 16,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  controlButton: {
    alignItems: 'center',
    gap: 4,
  },
  controlLabel: {
    color: '#FFF',
    fontSize: 10,
    marginTop: 4,
  },
  stopButton: {
    alignItems: 'center',
    gap: 4,
  },
  stopButtonInner: {
    backgroundColor: '#FF0066',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopLabel: {
    color: '#FFF',
    fontSize: 10,
    marginTop: 4,
  },
});