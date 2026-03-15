// contexts/MessengerLiveContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { liveService } from '../services/liveService';

interface MessengerLiveContextType {
  // État des lives
  activeLives: any[];
  featuredLives: any[];
  
  // Actions
  createLiveFromMessenger: (title: string, category: string) => Promise<string>;
  joinLiveFromStory: (liveId: string) => void;
  getLiveStats: (liveId: string) => Promise<any>;
  
  // Données en temps réel
  isWatchingLive: boolean;
  currentWatchingLive: any | null;
}

const MessengerLiveContext = createContext<MessengerLiveContextType | undefined>(undefined);

export const MessengerLiveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeLives, setActiveLives] = useState<any[]>([]);
  const [featuredLives, setFeaturedLives] = useState<any[]>([]);
  const [isWatchingLive, setIsWatchingLive] = useState(false);
  const [currentWatchingLive, setCurrentWatchingLive] = useState<any | null>(null);

  // Écouter les lives actifs pour les stories
  useEffect(() => {
    console.log('🎯 Messenger: Écoute des lives actifs...');
    
    const unsubscribe = liveService.listenToActiveLives((lives) => {
      console.log('📡 Messenger: Lives reçus:', lives.length);
      
      // Transformer les lives en format story
      const messengerLives = lives.map(live => ({
        id: live.id,
        name: live.hostName,
        avatar: live.hostAvatar,
        hasNewStories: true,
        seen: false,
        gradient: getRandomGradient(),
        live: true,
        viewers: formatViewers(live.viewersCount || 0),
        title: live.title,
        category: live.category,
        startTime: live.startTime
      }));
      
      setActiveLives(messengerLives);
      
      // Lives en vedette (les plus populaires)
      const featured = messengerLives
        .sort((a, b) => parseInt(b.viewers) - parseInt(a.viewers))
        .slice(0, 3);
      setFeaturedLives(featured);
    });

    return unsubscribe;
  }, []);

  const createLiveFromMessenger = async (title: string, category: string): Promise<string> => {
    if (!user) throw new Error('Utilisateur non connecté');

    console.log('🎥 Création live depuis messenger:', { title, category });
    
    const liveId = await liveService.createLiveStream({
      hostId: user.uid,
      hostName: user.displayName || 'Utilisateur',
      hostAvatar: user.photoURL || '',
      title,
      category,
      privacy: 'public'
    });

    return liveId;
  };

  const joinLiveFromStory = (liveId: string) => {
    const live = activeLives.find(l => l.id === liveId);
    if (live) {
      setCurrentWatchingLive(live);
      setIsWatchingLive(true);
    }
  };

  const getLiveStats = async (liveId: string) => {
    try {
      return await liveService.getLiveById(liveId);
    } catch (error) {
      console.error('Erreur récupération stats:', error);
      return null;
    }
  };

  const value: MessengerLiveContextType = {
    activeLives,
    featuredLives,
    createLiveFromMessenger,
    joinLiveFromStory,
    getLiveStats,
    isWatchingLive,
    currentWatchingLive
  };

  return (
    <MessengerLiveContext.Provider value={value}>
      {children}
    </MessengerLiveContext.Provider>
  );
};

// Fonctions helpers
const getRandomGradient = () => {
  const gradients = [
    ['#FF6B00', '#FF3D00'],
    ['#00B4FF', '#0066FF'],
    ['#FF00E5', '#B300FF'],
    ['#00FFA3', '#00D4FF'],
    ['#FFD600', '#FF6B00'],
    ['#FF416C', '#FF4B2B']
  ];
  return gradients[Math.floor(Math.random() * gradients.length)];
};

const formatViewers = (count: number): string => {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};

export const useMessengerLive = () => {
  const context = useContext(MessengerLiveContext);
  if (context === undefined) {
    throw new Error('useMessengerLive must be used within a MessengerLiveProvider');
  }
  return context;
};
