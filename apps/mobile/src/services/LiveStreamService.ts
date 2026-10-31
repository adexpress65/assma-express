// src/services/LiveStreamService.ts
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import * as VideoThumbnails from 'expo-video-thumbnails';

interface LiveStreamConfig {
  streamKey: string;
  rtmpUrl: string;
  quality: 'low' | 'medium' | 'high';
}

class LiveStreamService {
  private camera: Camera | null = null;
  private isStreaming = false;
  private streamUrl: string = '';
  
  async initializeStream(): Promise<LiveStreamConfig> {
    // Demander les permissions
    const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
    const { status: audioStatus } = await Audio.requestPermissionsAsync();
    
    if (cameraStatus !== 'granted' || audioStatus !== 'granted') {
      throw new Error('Permissions refusées');
    }

    // Générer une clé de stream unique
    const streamKey = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      streamKey,
      rtmpUrl: `rtmp://your-server.com/live/${streamKey}`,
      quality: 'medium'
    };
  }

  async startLiveStream(config: LiveStreamConfig) {
    if (!this.camera) throw new Error('Caméra non initialisée');
    
    this.isStreaming = true;
    this.streamUrl = config.rtmpUrl;
    
    // Démarrer le streaming
    // Note: Vous devrez implémenter votre propre serveur RTMP
    // ou utiliser un service comme Amazon IVS, Twitch, etc.
    
    return {
      streamId: config.streamKey,
      viewerUrl: `https://your-server.com/watch/${config.streamKey}`,
      thumbnail: await this.generateThumbnail()
    };
  }

  async stopLiveStream() {
    this.isStreaming = false;
    // Arrêter le streaming
  }

  private async generateThumbnail(): Promise<string> {
    // Générer une miniature pour la preview
    return 'https://via.placeholder.com/300x200';
  }

  async getLiveStreams(): Promise<any[]> {
    // Récupérer les streams actifs depuis votre backend
    return [];
  }

  setCamera(camera: Camera) {
    this.camera = camera;
  }
}

export const liveStreamService = new LiveStreamService();
