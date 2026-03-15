import { io, Socket } from 'socket.io-client';
import { ENV } from '@/config/env';

// --- Interfaces pour un typage robuste ---
export interface RealtimeMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

type MessageHandler = (message: RealtimeMessage) => void;

class RealtimeService {
  private socket: Socket | null = null;
  // Utilisation d'un Set pour permettre plusieurs écouteurs sur une même conv
  private messageHandlers = new Map<string, Set<MessageHandler>>();
  private activeRooms = new Set<string>(); // Garde trace des salons rejoints
  private initialized = false;

  /* ---------- INITIALISATION ---------- */

  init(token?: string) {
    if (this.initialized && this.socket?.connected) return;

    if (!ENV.apiBaseUrl) {
      console.error('❌ RealtimeService: apiBaseUrl manquant');
      return;
    }

    this.socket = io(ENV.apiBaseUrl, {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10, // Augmenté pour plus de résilience
      auth: { token: token ?? 'anonymous' },
    });

    this.setupSocketListeners();
    this.socket.connect();
    this.initialized = true;
  }

  /* ---------- LISTENERS INTERNES ---------- */

  private setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('🔗 WebSocket connecté ID:', this.socket?.id);
      // Auto-rejoin : si on a été déconnecté, on rejoint les salons actifs
      this.activeRooms.forEach(roomId => this.joinConversation(roomId));
    });

    this.socket.on('message:new', (message: RealtimeMessage) => {
      if (!message?.conversationId) return;
      const handlers = this.messageHandlers.get(message.conversationId);
      handlers?.forEach(handler => handler(message));
    });

    this.socket.on('connect_error', (err) => {
      console.error('❌ WebSocket error:', err.message);
    });
  }

  /* ---------- MESSAGERIE & SALONS ---------- */

  joinConversation(conversationId: string) {
    if (!this.socket) return;
    this.activeRooms.add(conversationId);
    this.socket.emit('conversation:join', conversationId);
  }

  leaveConversation(conversationId: string) {
    this.activeRooms.delete(conversationId);
    this.socket?.emit('conversation:leave', conversationId);
    this.messageHandlers.delete(conversationId);
  }

  // Ajout d'un système d'abonnement propre
  subscribeToMessages(conversationId: string, handler: MessageHandler) {
    if (!this.messageHandlers.has(conversationId)) {
      this.messageHandlers.set(conversationId, new Set());
    }
    this.messageHandlers.get(conversationId)?.add(handler);

    // Retourne une fonction de nettoyage (utilisable dans useEffect)
    return () => {
      const handlers = this.messageHandlers.get(conversationId);
      handlers?.delete(handler);
      if (handlers?.size === 0) this.messageHandlers.delete(conversationId);
    };
  }

  sendMessage(conversationId: string, content: string) {
    if (!this.socket?.connected) {
      console.warn("⚠️ Socket non connecté. Message non envoyé.");
      return;
    }
    this.socket.emit('message:send', { conversationId, content });
  }

  /* ---------- CLEANUP ---------- */

  disconnect() {
    if (!this.socket) return;
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
    this.messageHandlers.clear();
    this.activeRooms.clear();
    this.initialized = false;
    console.log('🧹 RealtimeService déconnecté');
  }
}

export const realtimeService = new RealtimeService();