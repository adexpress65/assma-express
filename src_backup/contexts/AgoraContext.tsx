// Dans src/contexts/AgoraContext.tsx - Version simulée
import React, { createContext, useContext, useState } from 'react';

interface AgoraContextType {
  joinChannel: (channelName: string, isHost: boolean) => Promise<void>;
  leaveChannel: () => Promise<void>;
  toggleMic: () => void;
  toggleCamera: () => void;
  switchCamera: () => void;
  isMicOn: boolean;
  isCameraOn: boolean;
  isFrontCamera: boolean;
  isInChannel: boolean;
  remoteUids: number[];
}

const AgoraContext = createContext<AgoraContextType | undefined>(undefined);

export const AgoraProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isInChannel, setIsInChannel] = useState(false);
  const [remoteUids, setRemoteUids] = useState<number[]>([]);

  const joinChannel = async (channelName: string, isHost: boolean = true) => {
    console.log(`🎥 SIMULATION: Rejoint ${channelName}`);
    setIsInChannel(true);
    setTimeout(() => setRemoteUids([123, 456]), 2000);
  };

  const leaveChannel = async () => {
    console.log('🚪 SIMULATION: Canal quitté');
    setIsInChannel(false);
    setRemoteUids([]);
  };

  const toggleMic = () => setIsMicOn(!isMicOn);
  const toggleCamera = () => setIsCameraOn(!isCameraOn);
  const switchCamera = () => setIsFrontCamera(!isFrontCamera);

  const value: AgoraContextType = {
    joinChannel, leaveChannel, toggleMic, toggleCamera, switchCamera,
    isMicOn, isCameraOn, isFrontCamera, isInChannel, remoteUids
  };

  return <AgoraContext.Provider value={value}>{children}</AgoraContext.Provider>;
};

export const useAgora = () => {
  const context = useContext(AgoraContext);
  if (context === undefined) {
    throw new Error('useAgora must be used within an AgoraProvider');
  }
  return context;
};