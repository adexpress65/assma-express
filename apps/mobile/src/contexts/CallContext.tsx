// src/contexts/CallContext.tsx
import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useAuth } from './AuthContext';

export type CallType = 'audio' | 'video';
export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended';

interface CallParticipant {
  id: string;
  name: string;
  avatar?: string;
  isMuted: boolean;
  isVideoOn: boolean;
  isSpeaking: boolean;
}

interface ActiveCall {
  id: string;
  type: CallType;
  status: CallStatus;
  conversationId: string;
  participants: CallParticipant[];
  startedAt: Date;
  duration: number;
}

interface CallContextType {
  // État
  activeCall: ActiveCall | null;
  isInCall: boolean;
  isMuted: boolean;
  isVideoOn: boolean;
  isSpeakerOn: boolean;
  
  // Actions
  startCall: (conversationId: string, type: CallType, participants: string[]) => Promise<void>;
  answerCall: (callId: string) => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleSpeaker: () => void;
  switchCamera: () => void;
  
  // Gestion
  incomingCall: ActiveCall | null;
  acceptIncomingCall: () => Promise<void>;
  rejectIncomingCall: () => Promise<void>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within CallProvider');
  }
  return context;
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const router = useRouter();
  
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [incomingCall, setIncomingCall] = useState<ActiveCall | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  
  const callDurationRef = useRef<NodeJS.Timeout>();
  const ringtoneRef = useRef<any>();

  const isInCall = activeCall?.status === 'connected';

  // Simulation d'appel entrant (pour le test)
  useEffect(() => {
    // Pour les tests, simuler un appel entrant après 30s
    const timer = setTimeout(() => {
      if (!activeCall && !incomingCall && Math.random() > 0.7) {
        simulateIncomingCall();
      }
    }, 30000);

    return () => clearTimeout(timer);
  }, [activeCall, incomingCall]);

  // Gestion de la durée d'appel
  useEffect(() => {
    if (activeCall?.status === 'connected') {
      callDurationRef.current = setInterval(() => {
        setActiveCall(prev => prev ? {
          ...prev,
          duration: prev.duration + 1
        } : null);
      }, 1000);
    }

    return () => {
      if (callDurationRef.current) {
        clearInterval(callDurationRef.current);
      }
    };
  }, [activeCall?.status]);

  const simulateIncomingCall = () => {
    setIncomingCall({
      id: `call_${Date.now()}`,
      type: Math.random() > 0.5 ? 'video' : 'audio',
      status: 'ringing',
      conversationId: 'test_conversation',
      participants: [
        {
          id: 'test_user',
          name: 'Test User',
          avatar: '👨‍💻',
          isMuted: false,
          isVideoOn: true,
          isSpeaking: false
        }
      ],
      startedAt: new Date(),
      duration: 0
    });

    // Jouer un son de sonnerie
    console.log('🔔 Sonnerie...');
  };

  const startCall = async (conversationId: string, type: CallType, participants: string[]): Promise<void> => {
    try {
      if (activeCall) {
        Alert.alert('Déjà en appel', 'Terminez l\'appel en cours avant d\'en démarrer un nouveau');
        return;
      }

      console.log(`📞 Démarrage d'un appel ${type} vers ${participants.length} participants`);

      const newCall: ActiveCall = {
        id: `call_${Date.now()}`,
        type,
        status: 'calling',
        conversationId,
        participants: [
          {
            id: user?.uid || 'unknown',
            name: user?.displayName || 'Vous',
            avatar: user?.photoURL || '👤',
            isMuted: false,
            isVideoOn: type === 'video',
            isSpeaking: false
          },
          ...participants.map(p => ({
            id: p,
            name: 'Participant',
            avatar: '👤',
            isMuted: false,
            isVideoOn: type === 'video',
            isSpeaking: false
          }))
        ],
        startedAt: new Date(),
        duration: 0
      };

      setActiveCall(newCall);
      
      // Simuler la connexion après 3 secondes
      setTimeout(() => {
        if (activeCall?.id === newCall.id) {
          setActiveCall(prev => prev ? { ...prev, status: 'connected' } : null);
          Alert.alert('Appel connecté', 'L\'appel a été établi');
        }
      }, 3000);

      // Naviguer vers l'écran d'appel
      router.push(`/call/${newCall.id}`);

    } catch (error) {
      console.error('❌ Erreur démarrage appel:', error);
      Alert.alert('Erreur', 'Impossible de démarrer l\'appel');
    }
  };

  const answerCall = async (callId: string): Promise<void> => {
    try {
      console.log('✅ Réponse à l\'appel');
      
      setActiveCall(prev => prev ? { ...prev, status: 'connected' } : null);
      setIncomingCall(null);
      
      // Naviguer vers l'écran d'appel
      router.push(`/call/${callId}`);
      
    } catch (error) {
      console.error('❌ Erreur réponse appel:', error);
    }
  };

  const endCall = async (): Promise<void> => {
    try {
      console.log('📞 Fin d\'appel');
      
      if (callDurationRef.current) {
        clearInterval(callDurationRef.current);
      }
      
      setActiveCall(null);
      setIncomingCall(null);
      setIsMuted(false);
      setIsVideoOn(true);
      setIsSpeakerOn(false);
      
      // Retourner à la conversation ou à l'écran précédent
      router.back();
      
    } catch (error) {
      console.error('❌ Erreur fin d\'appel:', error);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    console.log(`🔇 ${!isMuted ? 'Muté' : 'Démuté'}`);
  };

  const toggleVideo = () => {
    setIsVideoOn(!isVideoOn);
    console.log(`📹 ${!isVideoOn ? 'Caméra activée' : 'Caméra désactivée'}`);
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    console.log(`🔊 ${!isSpeakerOn ? 'Haut-parleur activé' : 'Haut-parleur désactivé'}`);
  };

  const switchCamera = () => {
    console.log('🔄 Changement de caméra');
    // Implémentation réelle nécessite une bibliothèque comme react-native-vision-camera
  };

  const acceptIncomingCall = async () => {
    if (!incomingCall) return;
    await answerCall(incomingCall.id);
  };

  const rejectIncomingCall = () => {
    console.log('❌ Appel refusé');
    setIncomingCall(null);
  };

  // Ouvrir un appel Web (solution temporaire pour Expo Go)
  const startWebCall = async (conversationId: string, type: CallType) => {
    const url = type === 'video' 
      ? `https://meet.jit.si/assma-${conversationId}`
      : `https://talky.io/assma-${conversationId}`;
    
    await WebBrowser.openBrowserAsync(url);
  };

  const value: CallContextType = {
    // État
    activeCall,
    isInCall,
    isMuted,
    isVideoOn,
    isSpeakerOn,
    
    // Actions
    startCall,
    answerCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleSpeaker,
    switchCamera,
    
    // Gestion
    incomingCall,
    acceptIncomingCall,
    rejectIncomingCall
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
};
