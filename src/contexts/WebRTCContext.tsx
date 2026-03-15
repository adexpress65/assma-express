// src/contexts/WebRTCContext.tsx
import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { Alert, Platform, PermissionsAndroid, AppState, AppStateStatus } from 'react-native';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

interface ActiveCall {
  id: string;
  roomId: string;
  type: 'audio' | 'video';
  status: 'connecting' | 'connected' | 'disconnected';
  participants: string[];
  isMuted: boolean;
  isVideoOn: boolean;
}

interface WebRTCContextType {
  activeCall: ActiveCall | null;
  isInCall: boolean;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isConnecting: boolean; // ✅ Nouveau: état de connexion au serveur
  startCall: (roomId: string, type: 'audio' | 'video') => Promise<void>;
  joinCall: (roomId: string, type: 'audio' | 'video') => Promise<void>;
  endCall: () => Promise<void>;
  toggleAudio: () => void;
  toggleVideo: () => void;
  switchCamera: () => void;
}

const WebRTCContext = createContext<WebRTCContextType | undefined>(undefined);
const SIGNALING_SERVER = 'https://assma-signaling-server.onrender.com';

export const WebRTCProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isConnecting, setIsConnecting] = useState(false); // ✅ Pour l'UI
  
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const currentRoomRef = useRef<string | null>(null);
  const isSocketReadyRef = useRef(false); // ✅ Flag pour savoir si connecté

  // ✅ Fonction pour réveiller Render (ping avant connexion)
  const wakeUpRenderServer = async (): Promise<boolean> => {
    console.log('⏳ Vérification serveur Render...');
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5000);
      
      // Ping le serveur (même une erreur 400 de Socket.io signifie qu'il est réveillé)
      const res = await fetch(`${SIGNALING_SERVER}/socket.io/?EIO=4&transport=polling`, {
        signal: controller.signal
      });
      
      console.log('✅ Serveur Render est réveillé');
      return true;
    } catch (e) {
      console.log('😴 Serveur Render dort (normal sur gratuit), tentative de connexion longue...');
      return false;
    }
  };

  // Initialisation Socket avec gestion reconnexion Render
  useEffect(() => {
    if (!user) return;

    const initSocket = async () => {
      // Optionnel: réveiller le serveur avant
      await wakeUpRenderServer();
      
      console.log('🔌 Connexion Socket.io à Render...');
      
      socketRef.current = io(SIGNALING_SERVER, {
        query: { userId: user.uid },
        transports: ['websocket', 'polling'],
        secure: true,
        reconnection: true,
        reconnectionAttempts: 15, // ✅ Augmenté pour Render
        reconnectionDelay: 3000,  // ✅ 3s entre chaque tentative
        timeout: 60000,           // ✅ 60s timeout (Render gratuit peut prendre 50s)
        forceNew: true,
      });

      socketRef.current.on('connect', () => {
        console.log('✅ Connecté à Render!');
        isSocketReadyRef.current = true;
        setIsConnecting(false);
      });

      socketRef.current.on('connect_error', (err) => {
        console.log('❌ Erreur connexion:', err.message);
        if (err.message.includes('timeout')) {
          console.log('⏳ Le serveur se réveille, reconnexion automatique dans 3s...');
        }
      });

      socketRef.current.on('reconnect_attempt', (attempt) => {
        console.log(`🔄 Reconnexion tentative ${attempt}/15...`);
        setIsConnecting(true);
      });

      socketRef.current.on('user-joined', async (data: { userId: string }) => {
        console.log(`👤 Participant rejoint: ${data.userId}`);
        if (data.userId === user?.uid) return;
        
        await createPeerConnection(data.userId, true);
        
        setActiveCall(prev => prev ? {
          ...prev,
          participants: [...new Set([...prev.participants, data.userId])],
          status: 'connected'
        } : null);
      });

      socketRef.current.on('user-left', (userId: string) => {
        console.log(`👋 Parti: ${userId}`);
        closePeerConnection(userId);
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.delete(userId);
          return next;
        });
      });

      socketRef.current.on('offer', async (data: { sdp: any; sender: string }) => {
        console.log('📨 Offre de:', data.sender);
        try {
          const pc = await createPeerConnection(data.sender, false);
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socketRef.current?.emit('answer', { target: data.sender, sdp: answer, roomId: currentRoomRef.current });
        } catch (e) { console.error(e); }
      });

      socketRef.current.on('answer', async (data: { sdp: any; sender: string }) => {
        console.log('📨 Réponse de:', data.sender);
        const pc = peerConnectionsRef.current.get(data.sender);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      });

      socketRef.current.on('ice-candidate', async (data: { candidate: any; sender: string }) => {
        const pc = peerConnectionsRef.current.get(data.sender);
        if (pc && data.candidate) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      });
    };

    initSocket();

    return () => {
      socketRef.current?.disconnect();
      isSocketReadyRef.current = false;
    };
  }, [user]);

  const requestPermissions = async (type: 'audio' | 'video'): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      const perms = [];
      if (type === 'video') perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
      perms.push(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      const res = await PermissionsAndroid.requestMultiple(perms);
      return Object.values(res).every(r => r === PermissionsAndroid.RESULTS.GRANTED);
    } catch { return false; }
  };

  const getMediaStream = async (type: 'audio' | 'video'): Promise<MediaStream> => {
    const ok = await requestPermissions(type);
    if (!ok) throw new Error('Permissions refusées');
    
    return await mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: type === 'video' ? { facingMode: 'user', width: 1280, height: 720 } : false,
    });
  };

  const createPeerConnection = async (peerId: string, isInitiator: boolean) => {
    if (peerConnectionsRef.current.has(peerId)) {
      peerConnectionsRef.current.get(peerId)?.close();
    }

    const pc = new RTCPeerConnection(configuration);
    peerConnectionsRef.current.set(peerId, pc);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

// Dans createPeerConnection
pc.onicecandidate = (e) => {
  if (e.candidate && socketRef.current?.connected) { // Ajoute la vérification de connexion
    socketRef.current.emit('ice-candidate', { 
      target: peerId, 
      candidate: e.candidate, 
      roomId: currentRoomRef.current 
    });
  }
};

    pc.ontrack = (e) => {
      console.log('🎥 Vidéo reçue de:', peerId);
      const [remoteStream] = e.streams;
      setRemoteStreams(prev => new Map(prev).set(peerId, remoteStream));
      setActiveCall(prev => prev ? { ...prev, status: 'connected' } : null);
    };

    if (isInitiator) {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('offer', { target: peerId, sdp: offer, roomId: currentRoomRef.current });
    }

    return pc;
  };

  const closePeerConnection = (peerId: string) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(peerId);
    }
  };
  
  const waitForSocketReady = async (timeoutMs = 20000): Promise<boolean> => {
  return new Promise((resolve) => {
    if (isSocketReadyRef.current) return resolve(true);

    const start = Date.now();

    const interval = setInterval(() => {
      if (isSocketReadyRef.current) {
        clearInterval(interval);
        resolve(true);
      }

      if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        resolve(false);
      }
    }, 500);
  });
};


const startCall = async (roomId: string, type: 'audio' | 'video') => {
  try {
    console.log("🚀 startCall demandé");

    const ready = await waitForSocketReady(20000);

    if (!ready) {
      Alert.alert(
        "Connexion lente",
        "Le serveur met du temps à répondre. Réessayez dans quelques secondes."
      );
      return;
    }

    console.log("✅ Socket prêt, démarrage appel");

    const stream = await getMediaStream(type);
    localStreamRef.current = stream;
    setLocalStream(stream);
    currentRoomRef.current = roomId;

    socketRef.current?.emit("join-room", {
      roomId,
      userId: user?.uid,
      type,
    });

    setActiveCall({
      id: Date.now().toString(),
      roomId,
      type,
      status: "connecting",
      participants: [user?.uid || ""],
      isMuted: false,
      isVideoOn: type === "video",
    });

  } catch (e: any) {
    console.error("❌ startCall error:", e);
    Alert.alert("Erreur appel", e.message || "Impossible de démarrer l'appel");
  }
};


  const joinCall = startCall;

  const endCall = async () => {
    peerConnectionsRef.current.forEach((pc, id) => closePeerConnection(id));
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    socketRef.current?.emit('leave-room', { roomId: currentRoomRef.current, userId: user?.uid });
    setActiveCall(null);
    setLocalStream(null);
    setRemoteStreams(new Map());
    localStreamRef.current = null;
  };

  const toggleAudio = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setActiveCall(prev => prev ? { ...prev, isMuted: !track.enabled } : null);
    }
  };

  const toggleVideo = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setActiveCall(prev => prev ? { ...prev, isVideoOn: track.enabled } : null);
    }
  };

  const switchCamera = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    // @ts-ignore
    if (track?._switchCamera) track._switchCamera();
  };

  return (
    <WebRTCContext.Provider value={{
      activeCall,
      isInCall: !!activeCall,
      localStream,
      remoteStreams,
      isConnecting, // ✅ Exposé pour afficher "Connexion au serveur..."
      startCall,
      joinCall,
      endCall,
      toggleAudio,
      toggleVideo,
      switchCamera,
    }}>
      {children}
    </WebRTCContext.Provider>
  );
};

export const useWebRTC = () => {
  const ctx = useContext(WebRTCContext);
  if (!ctx) throw new Error('useWebRTC must be used within WebRTCProvider');
  return ctx;
};
