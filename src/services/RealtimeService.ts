import { io, Socket } from 'socket.io-client';
import { ENV } from '@/config/env';

type MessageHandler = (message: any) => void;

class RealtimeService {
  private socket: Socket | null = null;
  private messageHandlers = new Map<string, MessageHandler>();
  private initialized = false;

  /* ---------- INIT EXPLICITE ---------- */

  init(token?: string) {
    if (this.initialized) return;

    if (!ENV.apiBaseUrl) {
      console.error('❌ RealtimeService: apiBaseUrl manquant');
      return;
    }

    this.socket = io(ENV.apiBaseUrl, {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      auth: {
        token: token ?? 'anonymous',
      },
    });

    this.setupSocketListeners();
    this.socket.connect();

    this.initialized = true;
    console.log('🚀 RealtimeService prêt');
  }

  /* ---------- LISTENERS ---------- */

  private setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('🔗 WebSocket connecté');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket déconnecté:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.error('❌ WebSocket error:', err.message);
    });

    this.socket.on('message:new', (message) => {
      if (!message?.conversationId) return;

      const handler = this.messageHandlers.get(message.conversationId);
      handler?.(message);
    });
  }

  /* ---------- MESSAGERIE ---------- */

  joinConversation(conversationId: string) {
    this.socket?.emit('conversation:join', conversationId);
  }

  leaveConversation(conversationId: string) {
    this.socket?.emit('conversation:leave', conversationId);
    this.messageHandlers.delete(conversationId);
  }

  sendMessage(conversationId: string, message: any) {
    this.socket?.emit('message:send', { conversationId, message });
  }

  onMessage(conversationId: string, handler: MessageHandler) {
    this.messageHandlers.set(conversationId, handler);
  }

  /* ---------- LIVE ---------- */

  startLiveStream(streamId: string) {
    this.socket?.emit('live:start', { streamId });
  }

  joinLiveStream(streamId: string) {
    this.socket?.emit('live:join', { streamId });
  }

  /* ---------- CLEANUP ---------- */

  disconnect() {
    if (!this.socket) return;

    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
    this.messageHandlers.clear();
    this.initialized = false;

    console.log('🧹 RealtimeService nettoyé');
  }
}

/**
 * Singleton contrôlé (PAS auto-init)
 */
export const realtimeService = new RealtimeService();
