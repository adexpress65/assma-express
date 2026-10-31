// app/live-broadcast.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  StatusBar,
  SafeAreaView,
  Modal,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/contexts/AuthContext';
import { useLive } from '../src/contexts/LiveContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface LiveSettings {
  isPublic: boolean;
  chatEnabled: boolean;
  giftsEnabled: boolean;
}

const LiveBroadcastScreen: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { createLive, stopLive } = useLive();

  const viewersIntervalRef = useRef<number | null>(null);

  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [isMicOn, setIsMicOn] = useState<boolean>(true);
  const [isCameraOn, setIsCameraOn] = useState<boolean>(true);
  const [isFrontCamera, setIsFrontCamera] = useState<boolean>(true);
  const [viewersCount, setViewersCount] = useState<number>(0);
  const [likesCount, setLikesCount] = useState<number>(0);
  const [giftsCount, setGiftsCount] = useState<number>(0);
  const [liveTitle, setLiveTitle] = useState<string>('');
  const [category, setCategory] = useState<string>('gaming');
  const [showChat, setShowChat] = useState<boolean>(false);
  const [showGifts, setShowGifts] = useState<boolean>(false);
  const [settings, setSettings] = useState<LiveSettings>({
    isPublic: true,
    chatEnabled: true,
    giftsEnabled: true,
  });

  const categories = [
    { id: 'gaming', name: 'ðŸŽ® Gaming', color: '#8B5CF6' },
    { id: 'music', name: 'ðŸŽµ Musique', color: '#EC4899' },
    { id: 'talk', name: 'ðŸ’¬ Talk', color: '#3B82F6' },
    { id: 'sports', name: 'âš½ Sports', color: '#10B981' },
    { id: 'art', name: 'ðŸŽ¨ Art', color: '#F59E0B' },
    { id: 'education', name: 'ðŸ“š Ã‰ducation', color: '#6366F1' },
  ];

  const startViewersSimulation = () => {
    if (viewersIntervalRef.current) return;
    viewersIntervalRef.current = setInterval(() => {
      setViewersCount((prev) => {
        const change = Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0;
        return Math.max(0, prev + change);
      });

      if (Math.random() > 0.8) {
        setLikesCount((prev) => prev + 1);
      }
    }, 3000);
  };

  const stopViewersSimulation = () => {
    if (viewersIntervalRef.current) {
      clearInterval(viewersIntervalRef.current);
      viewersIntervalRef.current = null;
    }
  };

  const handleStartLive = async () => {
    if (!liveTitle.trim()) {
      Alert.alert('Erreur', 'Veuillez donner un titre Ã  votre live');
      return;
    }

    setIsStarting(true);

    try {
      const liveData = {
        title: liveTitle,
        category,
        hostName: user?.displayName || 'Utilisateur',
        hostId: user?.uid || '',
        settings,
        timestamp: new Date().toISOString(),
      };

      const liveId = await createLive(liveData);

      console.log('ðŸ”„ Connexion Agora au canal:', `live_${liveId}`);
      await new Promise(resolve => setTimeout(resolve, 2000));

      setIsJoined(true);
      setIsLive(true);
      startViewersSimulation();

      console.log('âœ… Live dÃ©marrÃ©:', liveId);
    } catch (err) {
      console.error('âŒ Erreur dÃ©marrage live:', err);
      Alert.alert('Erreur', 'Impossible de dÃ©marrer le live');
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopLive = async () => {
    try {
      stopViewersSimulation();
      await stopLive();
      setIsLive(false);
      setIsJoined(false);
      router.back();
    } catch (err) {
      console.error('âŒ Erreur arrÃªt live:', err);
      Alert.alert('Erreur', 'Impossible d\'arrÃªter le live');
    }
  };

  useEffect(() => {
    return () => {
      stopViewersSimulation();
    };
  }, []);

  const toggleMic = () => {
    setIsMicOn((prev) => !prev);
  };

  const toggleCamera = () => {
    setIsCameraOn((prev) => !prev);
  };

  const switchCamera = () => {
    setIsFrontCamera((prev) => !prev);
  };

  const renderSetupScreen = () => (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>DÃ©marrer un live</Text>
      </View>

      <View style={styles.cameraPreview}>
        {isCameraOn ? (
          <View style={styles.cameraActive}>
            <Text style={styles.cameraText}>Preview CamÃ©ra</Text>
            <Text style={styles.cameraSubtext}>
              La preview Agora s'affichera ici
            </Text>
          </View>
        ) : (
          <View style={styles.cameraInactive}>
            <Ionicons name="videocam-off" size={48} color="gray" />
            <Text style={styles.cameraOffText}>CamÃ©ra dÃ©sactivÃ©e</Text>
          </View>
        )}
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity
          onPress={toggleCamera}
          style={[styles.controlButton, isCameraOn ? styles.controlButtonActive : styles.controlButtonInactive]}
        >
          <Ionicons name={isCameraOn ? 'videocam' : 'videocam-off'} size={20} color="white" />
          <Text style={styles.controlText}>
            {isCameraOn ? 'CamÃ©ra ON' : 'CamÃ©ra OFF'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={toggleMic}
          style={[styles.controlButton, isMicOn ? styles.controlButtonActive : styles.controlButtonInactive]}
        >
          <Ionicons name={isMicOn ? 'mic' : 'mic-off'} size={20} color="white" />
          <Text style={styles.controlText}>
            {isMicOn ? 'Micro ON' : 'Micro OFF'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={switchCamera}
          style={[styles.controlButton, styles.switchCameraButton]}
        >
          <Ionicons name="camera-reverse" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Titre du live *</Text>
          <TextInput
            value={liveTitle}
            onChangeText={setLiveTitle}
            placeholder="Donnez un titre attractif Ã  votre live..."
            placeholderTextColor="#9CA3AF"
            style={styles.textInput}
            maxLength={60}
          />
          <Text style={styles.charCount}>{liveTitle.length}/60</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>CatÃ©gorie</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.categoriesContainer}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setCategory(cat.id)}
                  style={[
                    styles.categoryButton,
                    { backgroundColor: category === cat.id ? cat.color : '#374151' }
                  ]}
                >
                  <Text style={styles.categoryText}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.settingsContainer}>
          <Text style={styles.settingsTitle}>ParamÃ¨tres</Text>

          <View style={styles.settingsList}>
            <View style={styles.settingItem}>
              <Text style={styles.settingText}>Live public</Text>
              <TouchableOpacity
                onPress={() => setSettings(prev => ({ ...prev, isPublic: !prev.isPublic }))}
                style={[styles.toggle, settings.isPublic ? styles.toggleOn : styles.toggleOff]}
              >
                <View style={[styles.toggleThumb, settings.isPublic ? styles.toggleThumbOn : styles.toggleThumbOff]} />
              </TouchableOpacity>
            </View>

            <View style={styles.settingItem}>
              <Text style={styles.settingText}>Chat activÃ©</Text>
              <TouchableOpacity
                onPress={() => setSettings(prev => ({ ...prev, chatEnabled: !prev.chatEnabled }))}
                style={[styles.toggle, settings.chatEnabled ? styles.toggleOn : styles.toggleOff]}
              >
                <View style={[styles.toggleThumb, settings.chatEnabled ? styles.toggleThumbOn : styles.toggleThumbOff]} />
              </TouchableOpacity>
            </View>

            <View style={styles.settingItem}>
              <Text style={styles.settingText}>Cadeaux activÃ©s</Text>
              <TouchableOpacity
                onPress={() => setSettings(prev => ({ ...prev, giftsEnabled: !prev.giftsEnabled }))}
                style={[styles.toggle, settings.giftsEnabled ? styles.toggleOn : styles.toggleOff]}
              >
                <View style={[styles.toggleThumb, settings.giftsEnabled ? styles.toggleThumbOn : styles.toggleThumbOff]} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleStartLive}
          disabled={isStarting || !liveTitle.trim()}
          style={[styles.startButton, (isStarting || !liveTitle.trim()) && styles.startButtonDisabled]}
        >
          {isStarting ? (
            <View style={styles.buttonContent}>
              <ActivityIndicator color="white" />
              <Text style={styles.buttonText}>DÃ©marrage...</Text>
            </View>
          ) : (
            <View style={styles.buttonContent}>
              <Ionicons name="videocam" size={24} color="white" />
              <Text style={styles.buttonText}>ðŸŽ¬ DÃ©marrer le live</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>ðŸ’¡ Conseils pour un bon live</Text>
          <Text style={styles.tipsText}>
            â€¢ Choisissez un titre accrocheur{'\n'}
            â€¢ VÃ©rifiez votre connexion internet{'\n'}
            â€¢ Interagissez avec votre audience{'\n'}
            â€¢ Partagez votre live sur les rÃ©seaux
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderLiveScreen = () => (
    <View style={styles.liveContainer}>
      <View style={styles.videoContainer}>
        {isCameraOn ? (
          <View style={styles.videoActive}>
            <Text style={styles.videoText}>ðŸ”´ EN DIRECT - Diffusion en cours</Text>
            <Text style={styles.videoSubtext}>
              Votre stream est actif - {viewersCount} spectateurs
            </Text>
          </View>
        ) : (
          <View style={styles.videoInactive}>
            <Ionicons name="videocam-off" size={64} color="gray" />
            <Text style={styles.videoOffText}>CamÃ©ra dÃ©sactivÃ©e</Text>
          </View>
        )}
      </View>

      <View style={styles.liveHeader}>
        <View style={styles.liveHeaderContent}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>EN DIRECT</Text>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Ionicons name="eye" size={16} color="white" />
              <Text style={styles.statText}>{viewersCount}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="heart" size={16} color="red" />
              <Text style={styles.statText}>{likesCount}</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'ArrÃªter le live',
                'Voulez-vous vraiment arrÃªter votre live ?',
                [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'ArrÃªter', style: 'destructive', onPress: handleStopLive },
                ]
              );
            }}
            style={styles.stopButton}
          >
            <Text style={styles.stopButtonText}>Stop</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.liveFooter}>
        <View style={styles.footerContent}>
          <View style={styles.controlsRow}>
            <TouchableOpacity onPress={switchCamera} style={styles.footerButton}>
              <Ionicons name="camera-reverse" size={24} color="white" />
            </TouchableOpacity>

            <TouchableOpacity onPress={toggleCamera} style={styles.footerButton}>
              <Ionicons name={isCameraOn ? 'videocam' : 'videocam-off'} size={24} color="white" />
            </TouchableOpacity>

            <TouchableOpacity onPress={toggleMic} style={[styles.footerButton, !isMicOn && styles.micOffButton]}>
              <Ionicons name={isMicOn ? 'mic' : 'mic-off'} size={24} color="white" />
            </TouchableOpacity>
          </View>

          <View style={styles.actionsRow}>
            {settings.chatEnabled && (
              <TouchableOpacity onPress={() => setShowChat(true)} style={styles.footerButton}>
                <Ionicons name="chatbubble" size={24} color="white" />
              </TouchableOpacity>
            )}

            {settings.giftsEnabled && (
              <TouchableOpacity onPress={() => setShowGifts(true)} style={styles.footerButton}>
                <Ionicons name="gift" size={24} color="white" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.bottomStats}>
          <View style={styles.bottomStat}>
            <Text style={styles.bottomStatNumber}>{viewersCount}</Text>
            <Text style={styles.bottomStatLabel}>Spectateurs</Text>
          </View>
          <View style={styles.bottomStat}>
            <Text style={styles.bottomStatNumber}>{likesCount}</Text>
            <Text style={styles.bottomStatLabel}>Likes</Text>
          </View>
          <View style={styles.bottomStat}>
            <Text style={styles.bottomStatNumber}>{giftsCount}</Text>
            <Text style={styles.bottomStatLabel}>Cadeaux</Text>
          </View>
        </View>
      </View>

      <View style={styles.tipsOverlay}>
        <Text style={styles.tipsOverlayText}>
          ðŸ’¡ Interagissez avec vos spectateurs ! Demandez-leur de liker et partager.
        </Text>
      </View>

      <Modal visible={showChat} animationType="slide" transparent onRequestClose={() => setShowChat(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chat en direct</Text>
              <TouchableOpacity onPress={() => setShowChat(false)}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
            <View style={styles.chatPlaceholder}>
              <Text style={styles.placeholderText}>Interface du chat en direct</Text>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showGifts} animationType="slide" transparent onRequestClose={() => setShowGifts(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.giftsModal]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cadeaux reÃ§us</Text>
              <TouchableOpacity onPress={() => setShowGifts(false)}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
            <View style={styles.giftsPlaceholder}>
              <Text style={styles.placeholderText}>Interface des cadeaux</Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="black" />
      {isLive ? renderLiveScreen() : renderSetupScreen()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'black',
  },
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  cameraPreview: {
    backgroundColor: '#374151',
    borderRadius: 16,
    height: 200,
    marginBottom: 20,
    overflow: 'hidden',
  },
  cameraActive: {
    flex: 1,
    backgroundColor: '#4B5563',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraText: {
    color: 'white',
    fontSize: 18,
    marginBottom: 8,
  },
  cameraSubtext: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  cameraInactive: {
    flex: 1,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraOffText: {
    color: '#9CA3AF',
    marginTop: 8,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 12,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  controlButtonActive: {
    backgroundColor: '#EF4444',
  },
  controlButtonInactive: {
    backgroundColor: '#374151',
  },
  switchCameraButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
  },
  controlText: {
    color: 'white',
    marginLeft: 8,
    fontWeight: '500',
  },
  formContainer: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: '#374151',
    color: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  charCount: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'right',
  },
  categoriesContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  categoryText: {
    color: 'white',
    fontWeight: '500',
  },
  settingsContainer: {
    backgroundColor: '#374151',
    borderRadius: 16,
    padding: 16,
  },
  settingsTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  settingsList: {
    gap: 12,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingText: {
    color: 'white',
    fontSize: 14,
  },
  toggle: {
    width: 48,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    padding: 2,
  },
  toggleOn: {
    backgroundColor: '#10B981',
  },
  toggleOff: {
    backgroundColor: '#6B7280',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'white',
  },
  toggleThumbOn: {
    transform: [{ translateX: 24 }],
  },
  toggleThumbOff: {
    transform: [{ translateX: 0 }],
  },
  startButton: {
    backgroundColor: '#EF4444',
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 8,
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  buttonContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  tipsContainer: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  tipsTitle: {
    color: '#60A5FA',
    fontWeight: '600',
    marginBottom: 8,
  },
  tipsText: {
    color: '#93C5FD',
    fontSize: 14,
    lineHeight: 20,
  },
  liveContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  videoContainer: {
    flex: 1,
  },
  videoActive: {
    flex: 1,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  videoSubtext: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  videoInactive: {
    flex: 1,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoOffText: {
    color: '#9CA3AF',
    fontSize: 18,
    marginTop: 8,
  },
  liveHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 48,
    paddingHorizontal: 16,
  },
  liveHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    marginRight: 6,
  },
  liveBadgeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  statText: {
