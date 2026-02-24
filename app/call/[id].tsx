// app/call/[id].tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
  ImageBackground,
  Animated,
  ScrollView
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useCall } from '../../src/contexts/CallContext';
import { useAuth } from '../../src/contexts/AuthContext';

const { width, height } = Dimensions.get('window');

export default function CallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const {
    activeCall,
    isMuted,
    isVideoOn,
    isSpeakerOn,
    endCall,
    toggleMute,
    toggleVideo,
    toggleSpeaker,
    switchCamera
  } = useCall();

  const [timer, setTimer] = useState(0);
  const [participants, setParticipants] = useState<any[]>([]);
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (activeCall?.status === 'connected') {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeCall?.status]);

  useEffect(() => {
    // Animation de clignotement pour l'appel en cours
    if (activeCall?.status === 'calling' || activeCall?.status === 'ringing') {
      const blinkInterval = setInterval(() => {
        setBlinking(prev => !prev);
      }, 500);
      return () => clearInterval(blinkInterval);
    }
  }, [activeCall?.status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderCallStatus = () => {
    if (!activeCall) return null;

    switch (activeCall.status) {
      case 'calling':
        return (
          <View style={styles.statusContainer}>
            <Animated.View style={[styles.ringingDot, { opacity: blinking ? 1 : 0.3 }]} />
            <Text style={styles.statusText}>Appel en cours...</Text>
          </View>
        );
      
      case 'ringing':
        return (
          <View style={styles.statusContainer}>
            <Animated.View style={[styles.ringingDot, { opacity: blinking ? 1 : 0.3 }]} />
            <Text style={styles.statusText}>Sonnerie...</Text>
          </View>
        );
      
      case 'connected':
        return (
          <View style={styles.statusContainer}>
            <Text style={styles.durationText}>{formatTime(timer)}</Text>
            <Text style={styles.statusText}>En communication</Text>
          </View>
        );
      
      default:
        return <Text style={styles.statusText}>Appel</Text>;
    }
  };

  const renderParticipant = (participant: any, isLocal = false) => {
    const isUser = participant.id === user?.uid;
    
    return (
      <View style={[styles.participantCard, isLocal && styles.localParticipant]}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{participant.avatar || '👤'}</Text>
          </View>
          {participant.isSpeaking && (
            <View style={styles.speakingIndicator} />
          )}
        </View>
        
        <Text style={styles.participantName} numberOfLines={1}>
          {isUser ? 'Vous' : participant.name}
        </Text>
        
        <View style={styles.participantStatus}>
          {participant.isMuted && (
            <Ionicons name="mic-off" size={14} color="#FF3B30" />
          )}
          {activeCall?.type === 'video' && !participant.isVideoOn && (
            <Ionicons name="videocam-off" size={14} color="#FF3B30" />
          )}
        </View>
      </View>
    );
  };

  const renderControls = () => {
    if (!activeCall) return null;

    return (
      <View style={styles.controlsContainer}>
        {/* Bouton Mute */}
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={toggleMute}
        >
          <Ionicons 
            name={isMuted ? "mic-off" : "mic"} 
            size={28} 
            color={isMuted ? "#FFFFFF" : "#FFFFFF"} 
          />
          <Text style={styles.controlText}>{isMuted ? 'Activer' : 'Mute'}</Text>
        </TouchableOpacity>

        {/* Bouton Vidéo (uniquement pour les appels vidéo) */}
        {activeCall.type === 'video' && (
          <TouchableOpacity
            style={[styles.controlButton, !isVideoOn && styles.controlButtonActive]}
            onPress={toggleVideo}
          >
            <Ionicons 
              name={isVideoOn ? "videocam" : "videocam-off"} 
              size={28} 
              color={isVideoOn ? "#FFFFFF" : "#FFFFFF"} 
            />
            <Text style={styles.controlText}>{isVideoOn ? 'Caméra' : 'Activer'}</Text>
          </TouchableOpacity>
        )}

        {/* Bouton Haut-parleur */}
        <TouchableOpacity
          style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
          onPress={toggleSpeaker}
        >
          <Ionicons 
            name={isSpeakerOn ? "volume-high" : "volume-medium"} 
            size={28} 
            color={isSpeakerOn ? "#FF9500" : "#FFFFFF"} 
          />
          <Text style={styles.controlText}>Haut-parleur</Text>
        </TouchableOpacity>

        {/* Bouton Fin d'appel */}
        <TouchableOpacity
          style={[styles.controlButton, styles.endCallButton]}
          onPress={endCall}
        >
          <Ionicons name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
          <Text style={[styles.controlText, styles.endCallText]}>Raccrocher</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (!activeCall) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="call" size={64} color="#666" />
          <Text style={styles.errorText}>Aucun appel actif</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        
        {/* En-tête */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.minimizeButton} onPress={() => router.back()}>
            <Ionicons name="chevron-down" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.headerInfo}>
            <Text style={styles.callTitle} numberOfLines={1}>
              {activeCall.type === 'video' ? 'Appel vidéo' : 'Appel audio'}
            </Text>
            {renderCallStatus()}
          </View>
          
          <TouchableOpacity style={styles.infoButton}>
            <Ionicons name="information-circle-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Participants */}
        <ScrollView 
          style={styles.participantsContainer}
          contentContainerStyle={styles.participantsContent}
          showsVerticalScrollIndicator={false}
        >
          {activeCall.participants.map((participant, index) => (
            <View key={participant.id} style={styles.participantWrapper}>
              {renderParticipant(participant, index === 0)}
            </View>
          ))}
        </ScrollView>

        {/* Contrôles */}
        {renderControls()}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  minimizeButton: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  callTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  infoButton: {
    padding: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ringingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CD964',
    marginRight: 8,
  },
  statusText: {
    color: '#8E8E93',
    fontSize: 14,
  },
  durationText: {
    color: '#4CD964',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  participantsContainer: {
    flex: 1,
  },
  participantsContent: {
    padding: 16,
    paddingBottom: 100,
  },
  participantWrapper: {
    marginBottom: 16,
  },
  participantCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  localParticipant: {
    backgroundColor: '#2C2C2E',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3A3A3C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
  },
  speakingIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4CD964',
    borderWidth: 3,
    borderColor: '#000000',
  },
  participantName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  participantStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    backgroundColor: '#000000',
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  controlButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    minWidth: 70,
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
  },
  controlText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  endCallButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 20,
  },
  endCallText: {
    fontWeight: '600',
  },
});