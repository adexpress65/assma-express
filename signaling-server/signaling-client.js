// signaling-client.js
import io from 'socket.io-client';

class SignalingClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect(userId, userName, userAvatar) {
    // URL Render - IMPORTANT : HTTPS, pas WSS
    const serverUrl = 'https://assma-signaling-server.onrender.com';
    
    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      timeout: 20000,
      query: {
        userId,
        userName,
        userAvatar,
        platform: 'mobile'
      }
    });

    // Événements
    this.socket.on('connect', () => {
      console.log('✅ Connecté au serveur de signalisation');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Erreur de connexion:', error.message);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Déconnecté:', reason);
      this.isConnected = false;
    });

    return this.socket;
  }

  // Méthodes utilitaires
  joinRoom(roomId) {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject('Socket non initialisé');
        return;
      }

      this.socket.emit('join-room', {
        roomId,
        userId: this.socket.io.opts.query.userId,
        userName: this.socket.io.opts.query.userName,
        userAvatar: this.socket.io.opts.query.userAvatar
      });

      this.socket.once('room-joined', (data) => {
        resolve(data);
      });

      this.socket.once('room-error', (error) => {
        reject(error.message);
      });

      // Timeout
      setTimeout(() => reject('Timeout'), 10000);
    });
  }

  sendOffer(targetUserId, sdp, type = 'video') {
    this.socket.emit('offer', { targetUserId, sdp, type });
  }

  sendAnswer(targetUserId, sdp) {
    this.socket.emit('answer', { targetUserId, sdp });
  }

  sendIceCandidate(targetUserId, candidate) {
    this.socket.emit('ice-candidate', { targetUserId, candidate });
  }

  disconnect() {
    if (this.socket) {
      this.socket.emit('leave-room');
      this.socket.disconnect();
    }
  }
}

export default new SignalingClient();