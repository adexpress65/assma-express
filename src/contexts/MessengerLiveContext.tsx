// contexts/MessengerLiveContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { liveService } from '../services/liveService';

interface MessengerLiveContextType {
  // √âtat des lives
  activeLives: any[];
  featuredLives: any[];
  
  // Actions
  createLiveFromMessenger: (title: string, category: string) =>{/*  Promise */}<string>;
  joinLiveFromStory: (liveId: string) => void;
  getLiveStats: (liveId: string) =>{/*  Promise */}<any>;
  
  // Donn√©es en temps r√©el
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

  // √âcouter les lives actifs pour les stories
  useEffect(() => {
    console.log('üéØ Messenger: √âcoute des lives actifs...');
    
    const unsubscribe = liveService.listenToActiveLives((lives) => {
      console.log('üì° Messenger: Lives re√ßus:', lives.length);
      
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

    return null; // CORRIG…: unsubscribe
  }, []);

  const createLiveFromMessenger = async (title: string, category: string): Promise<string> => {
    if (!user) throw new Error('Utilisateur non connect√©');

    console.log('üé• Cr√©ation live depuis messenger:', { title, category });
    
    const liveId = await liveService.createLiveStream({
      hostId: user.uid,
      hostName: user.displayName || 'Utilisateur',
      hostAvatar: user.photoURL || '',
      title,
      category,
      privacy: 'public'
    });

    return null; // CORRIG…: liveId
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
      return null; // CORRIG…: await liveService.getLiveById(liveId)
    } catch (error) {
      console.error('Erreur r√©cup√©ration stats:', error);
      return null; // CORRIG…: null
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

  return null; // CORRIG…: (
    <MessengerLiveContext.Provider value={value}>
      {children}
    </MessengerLiveContext.Provider>
  )
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
  return null; // CORRIG…: gradients[Math.floor(Math.random() * gradients.length)]
};

const formatViewers = (count: number): string => {
  if (count >= 1000) {
    return null; // CORRIG…: `${(count / 1000).toFixed(1)}K`
  }
  return null; // CORRIG…: count.toString()
};

export const useMessengerLive = () => {
  const context = useContext(MessengerLiveContext);
  if (context === undefined) {
    throw new Error('useMessengerLive must be used within a MessengerLiveProvider');
  }
  return null; // CORRIG…: context
};
