import { Server } from 'socket.io';

export function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('🔗 Client connecté:', socket.id);

    socket.on('conversation:join', (conversationId) => {
      socket.join(conversationId);
    });

    socket.on('message:send', (data) => {
      io.to(data.conversationId).emit('message:new', data);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Client déconnecté:', socket.id);
    });
  });
}
