// contexts/LiveContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { liveService } from '../services/liveService';

interface LiveContextType {
  activeLives: any[];
  currentLive: any | null;
  isBroadcasting: boolean;
  createLive: (liveData: any) => Promise<string>;
  joinLive: (liveId: string) => Promise<void>;
  leaveLive: () => Promise<void>;
  stopLive: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  sendGift: (giftType: string, giftValue: number) => Promise<void>;
  likeLive: () => Promise<void>;
  liveMessages: any[];
  liveStats: any;
}

const LiveContext = createContext<LiveContextType | undefined>(undefined);

export const LiveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeLives, setActiveLives] = useState<any[]>([]);
  const [currentLive, setCurrentLive] = useState<any | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [liveMessages, setLiveMessages] = useState<any[]>([]);
  const [liveStats, setLiveStats] = useState<any>({});

  useEffect(() => {
    if (!user) {
      console.log('🚫 Aucun utilisateur connecté - arrêt écoute lives');
      setActiveLives([]);
      return;
    }

    console.log('🔴 Démarrage écoute des lives actifs pour:', user.uid);
    const unsubscribe = liveService.listenToActiveLives((lives) => {
      console.log('📡 Lives actifs reçus:', lives.length);
      setActiveLives(lives);
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!currentLive?.id) {
      setLiveMessages([]);
      return;
    }

    console.log('💬 Écoute des messages pour live:', currentLive.id);
    const unsubscribe = liveService.listenToLiveMessages(currentLive.id, (messages) => {
      setLiveMessages(messages);
    });
    return unsubscribe;
  }, [currentLive?.id]);

  useEffect(() => {
    if (!currentLive?.id) {
      setLiveStats({});
      return;
    }

    console.log('📊 Écoute des stats pour live:', currentLive.id);
    const unsubscribe = liveService.listenToLiveStats(currentLive.id, (stats) => {
      setLiveStats(stats);
    });
    return unsubscribe;
  }, [currentLive?.id]);

  const createLive = async (liveData: any): Promise<string> => {
    if (!user) throw new Error('Utilisateur non connecté');

    console.log('🎥 Création du live:', liveData);
    const liveId = await liveService.createLiveStream({
      ...liveData,
      hostId: user.uid,
      hostName: user.displayName || 'Utilisateur',
      hostAvatar: user.photoURL || ''
    });

    const newLive = { 
      id: liveId, 
      ...liveData,
      hostId: user.uid,
      hostName: user.displayName || 'Utilisateur'
    };
    
    setCurrentLive(newLive);
    setIsBroadcasting(true);
    console.log('✅ Live créé avec ID:', liveId);
    
    return liveId;
  };

  const joinLive = async (liveId: string): Promise<void> => {
    if (!user) throw new Error('Utilisateur non connecté');

    console.log('🎯 Rejoindre le live:', liveId);
    await liveService.joinLiveStream(liveId, user.uid, user.displayName || 'Utilisateur');

    const live = activeLives.find(l => l.id === liveId);
    if (live) {
      setCurrentLive(live);
      console.log('✅ Rejoint le live:', live.title);
    }
  };

  const leaveLive = async (): Promise<void> => {
    if (!currentLive || !user) return;

    console.log('🚪 Quitter le live:', currentLive.id);
    await liveService.leaveLiveStream(currentLive.id, user.uid);
    setCurrentLive(null);
    setLiveMessages([]);
    setLiveStats({});
  };

  const stopLive = async (): Promise<void> => {
    if (!currentLive) return;

    console.log('🛑 Arrêt du live:', currentLive.id);
    await liveService.stopLiveStream(currentLive.id);
    setCurrentLive(null);
    setIsBroadcasting(false);
    setLiveMessages([]);
    setLiveStats({});
  };

  const sendMessage = async (text: string): Promise<void> => {
    if (!currentLive || !user || !text.trim()) return;

    console.log('💬 Envoi message:', text);
    await liveService.sendMessage(currentLive.id, {
      userId: user.uid,
      userName: user.displayName || 'Utilisateur',
      userAvatar: user.photoURL || '',
      text: text.trim()
    });
  };

  const sendGift = async (giftType: string, giftValue: number): Promise<void> => {
    if (!currentLive || !user) return;

    console.log('🎁 Envoi cadeau:', giftType, giftValue);
    await liveService.sendGift(currentLive.id, {
      fromUserId: user.uid,
      fromUserName: user.displayName || 'Utilisateur',
      toHostId: currentLive.hostId,
      giftType: giftType as any,
      giftValue
    });
  };

  const likeLive = async (): Promise<void> => {
    if (!currentLive) return;

    console.log('❤️ Like du live:', currentLive.id);
    await liveService.likeLive(currentLive.id);
  };

  const value: LiveContextType = {
    activeLives,
    currentLive,
    isBroadcasting,
    createLive,
    joinLive,
    leaveLive,
    stopLive,
    sendMessage,
    sendGift,
    likeLive,
    liveMessages,
    liveStats
  };

  return (
    <LiveContext.Provider value={value}>
      {children}
    </LiveContext.Provider>
  );
};

export const useLive = () => {
  const context = useContext(LiveContext);
  if (context === undefined) {
    throw new Error('useLive must be used within a LiveProvider');
  }
  return context;
};
